<?php

namespace App\Domain\ServiceOrders;

use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class ServiceOrderService
{
    public function __construct(private StockDeductionService $stockDeduction) {}

    public function create(array $validated, ?int $userId): ServiceOrder
    {
        return DB::transaction(function () use ($validated, $userId) {
            $items = $validated['items'] ?? [];
            $discount = (float) ($validated['discount'] ?? 0);

            $order = ServiceOrder::create([
                'client_id' => $validated['client_id'] ?? null,
                'date' => $validated['date'],
                'vehicle' => $validated['vehicle'],
                'mileage' => $validated['mileage'] ?? null,
                'discount' => $discount,
                'total_amount' => 0,
                'net_amount' => 0,
                'status' => $validated['status'] ?? 'EN COURS',
                'payment_status' => $validated['payment_status'] ?? 'NON PAYE',
                'notes' => $validated['notes'] ?? null,
                'commercial_id' => $validated['commercial_id'] ?? null,
                'created_by' => $userId,
            ]);

            ServiceItem::withoutEvents(function () use ($order, $items) {
                foreach ($items as $i => $itemData) {
                    $order->items()->create($this->buildItemAttributes($itemData, $i));
                }
            });

            $order->recalculateTotals();

            $this->stockDeduction->deductForOrder($order, $userId);

            return $order->fresh()->load(['commercial', 'items.product', 'clientRecord']);
        });
    }

    public function update(ServiceOrder $order, array $validated, ?int $userId): ServiceOrder
    {
        return DB::transaction(function () use ($order, $validated, $userId) {
            $items = $validated['items'] ?? null;
            unset($validated['items']);

            $newStatus = $validated['status'] ?? null;
            $cancellingOrder = $newStatus === 'ANNULE' && $order->status !== 'ANNULE';

            $discount = (float) ($validated['discount'] ?? $order->discount);

            $order->update(array_merge($validated, [
                'discount' => $discount,
                'updated_by' => $userId,
            ]));

            if ($items !== null) {
                $this->stockDeduction->restoreForOrder($order, $userId);

                ServiceItem::withoutEvents(function () use ($order, $items) {
                    $order->items()->delete();
                    foreach ($items as $i => $itemData) {
                        $order->items()->create($this->buildItemAttributes($itemData, $i));
                    }
                });

                $order->recalculateTotals();

                if (! $cancellingOrder) {
                    $this->stockDeduction->deductForOrder($order, $userId);
                }
            } elseif ($cancellingOrder) {
                $this->stockDeduction->restoreForOrder($order, $userId);
            }

            return $order->fresh()->load(['commercial', 'items.product', 'clientRecord']);
        });
    }

    public function delete(ServiceOrder $order, ?int $userId = null): void
    {
        DB::transaction(function () use ($order, $userId) {
            $this->stockDeduction->restoreForOrder($order, $userId);

            $transactionIds = $order->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $order->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $order->delete();
        });
    }

    public function syncItems(ServiceOrder $order, array $items, ?int $userId): void
    {
        $this->stockDeduction->restoreForOrder($order, $userId);

        ServiceItem::withoutEvents(function () use ($order, $items) {
            $order->items()->delete();
            foreach ($items as $i => $itemData) {
                $order->items()->create($this->buildItemAttributes($itemData, $i));
            }
        });

        $order->recalculateTotals();

        if ($order->status !== 'ANNULE') {
            $this->stockDeduction->deductForOrder($order, $userId);
        }
    }

    private function buildItemAttributes(array $itemData, int $index): array
    {
        $type = $itemData['item_type'] ?? 'service';

        if ($type === 'part') {
            $qty = (int) ($itemData['quantity'] ?? 1);
            $price = (float) ($itemData['unit_price'] ?? 0);

            return [
                'item_type' => 'part',
                'product_id' => $itemData['product_id'] ?? null,
                'quantity' => $qty,
                'unit_price' => $price,
                'line_total' => $qty * $price,
                'parts_cost' => 0,
                'labor_cost' => 0,
                'description' => $itemData['description'] ?? null,
                'sort_order' => $itemData['sort_order'] ?? $index,
            ];
        }

        $qty = max(1, (int) ($itemData['quantity'] ?? 1));
        $parts = (float) ($itemData['parts_cost'] ?? 0);
        $labor = (float) ($itemData['labor_cost'] ?? 0);

        return [
            'item_type' => 'service',
            'service_type' => $itemData['service_type'] ?? null,
            'product_id' => $itemData['product_id'] ?? null,
            'quantity' => $qty,
            'parts_cost' => $parts,
            'labor_cost' => $labor,
            'line_total' => $qty * ($parts + $labor),
            'description' => $itemData['description'] ?? null,
            'sort_order' => $itemData['sort_order'] ?? $index,
        ];
    }
}
