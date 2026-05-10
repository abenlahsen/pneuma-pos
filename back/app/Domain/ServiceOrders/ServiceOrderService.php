<?php

namespace App\Domain\ServiceOrders;

use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class ServiceOrderService
{
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
                    $parts = (float) ($itemData['parts_cost'] ?? 0);
                    $labor = (float) ($itemData['labor_cost'] ?? 0);
                    $order->items()->create([
                        'product_id' => $itemData['product_id'],
                        'description' => $itemData['description'] ?? null,
                        'parts_cost' => $parts,
                        'labor_cost' => $labor,
                        'line_total' => $parts + $labor,
                        'sort_order' => $itemData['sort_order'] ?? $i,
                    ]);
                }
            });

            $order->recalculateTotals();

            return $order->fresh()->load(['commercial', 'items.product.service', 'clientRecord']);
        });
    }

    public function update(ServiceOrder $order, array $validated, ?int $userId): ServiceOrder
    {
        return DB::transaction(function () use ($order, $validated, $userId) {
            $items = $validated['items'] ?? null;
            unset($validated['items']);

            $discount = (float) ($validated['discount'] ?? $order->discount);

            $order->update(array_merge($validated, [
                'discount' => $discount,
                'updated_by' => $userId,
            ]));

            if ($items !== null) {
                ServiceItem::withoutEvents(function () use ($order, $items) {
                    $order->items()->delete();
                    foreach ($items as $i => $itemData) {
                        $parts = (float) ($itemData['parts_cost'] ?? 0);
                        $labor = (float) ($itemData['labor_cost'] ?? 0);
                        $order->items()->create([
                            'product_id' => $itemData['product_id'],
                            'description' => $itemData['description'] ?? null,
                            'parts_cost' => $parts,
                            'labor_cost' => $labor,
                            'line_total' => $parts + $labor,
                            'sort_order' => $itemData['sort_order'] ?? $i,
                        ]);
                    }
                });
            }

            $order->recalculateTotals();

            return $order->fresh()->load(['commercial', 'items.product.service', 'clientRecord']);
        });
    }

    public function delete(ServiceOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $transactionIds = $order->payments()->whereNotNull('transaction_id')->pluck('transaction_id');

            $order->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $order->delete();
        });
    }
}
