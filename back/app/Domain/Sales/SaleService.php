<?php

namespace App\Domain\Sales;

use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePaymentAllocation;
use App\Models\Stock;
use App\Models\Transaction;
use App\Services\ActivityLogService;
use App\Services\StockMovementService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SaleService
{
    public function __construct(
        private StockMovementService $movements,
        private ActivityLogService $activityLog,
    ) {}

    public function create(array $validated, ?int $userId = null): Sale
    {
        return DB::transaction(function () use ($validated, $userId) {
            $items = $validated['items'] ?? [];

            $saleData = $this->prepareSalePayload($validated, $items);
            $saleData['created_by'] = $userId;

            $sale = Sale::create($this->filterColumns('sales', $saleData));

            $this->persistItems($sale, $items, $userId, $this->statusAppliesStock($sale->status));

            $fresh = $sale->fresh(['linkedClient.cityRelation', 'commercial', 'linkedCarrier', 'linkedPartner', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);

            $snapshot = $this->activityLog->buildSaleSnapshot($fresh);
            $this->activityLog->logSaleCreated($fresh, $snapshot, $userId, ActivityLogService::resolveUserName($userId));

            return $fresh;
        });
    }

    public function update(Sale $sale, array $validated, ?int $userId = null): Sale
    {
        $sale->loadMissing(['linkedClient', 'commercial', 'linkedCarrier', 'linkedPartner']);
        $beforeSnapshot = $this->activityLog->buildSaleSnapshot($sale);

        return DB::transaction(function () use ($sale, $validated, $userId, $beforeSnapshot) {
            $items = $validated['items'] ?? null;

            $oldStatus = $sale->status;
            $newStatus = array_key_exists('status', $validated) ? $validated['status'] : $oldStatus;
            $wasApplied = $this->statusAppliesStock($oldStatus);
            $willApply = $this->statusAppliesStock($newStatus);

            $saleData = $items !== null
                ? $this->prepareSalePayload($validated, $items, $sale)
                : $this->prepareSalePayloadWithoutRecomputingTotals($validated, $sale);

            $sale->update($this->filterColumns('sales', $saleData));

            if ($items !== null) {
                if ($wasApplied) {
                    $this->restoreStockForItems($sale, $userId);
                }
                $sale->items()->delete();
                $this->persistItems($sale, $items, $userId, $willApply);
            } elseif ($wasApplied && ! $willApply) {
                // Sale cancelled without touching items — release the stock it held.
                $this->restoreStockForItems($sale, $userId);
            } elseif (! $wasApplied && $willApply) {
                // Sale reactivated from ANNULE without touching items — re-deduct stock.
                $this->applyStockForItems($sale, $userId);
            }

            $fresh = $sale->fresh(['linkedClient.cityRelation', 'commercial', 'linkedCarrier', 'linkedPartner', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);

            $this->refreshPaymentStatus($fresh);
            $fresh->refresh();

            $afterSnapshot = $this->activityLog->buildSaleSnapshot($fresh);
            $this->activityLog->logSaleUpdated($fresh, $beforeSnapshot, $afterSnapshot, $userId, ActivityLogService::resolveUserName($userId));

            return $fresh;
        });
    }

    private function refreshPaymentStatus(Sale $sale): void
    {
        $totalPaid = $sale->paid_amount;
        $totalSale = (float) $sale->total_sale;
        $status = $totalPaid <= 0
                ? SalePaymentStatus::NON_PAYE->value
                : ($totalPaid >= $totalSale ? SalePaymentStatus::PAYE->value : SalePaymentStatus::PARTIEL->value);
        $sale->update(['payment_status' => $status]);
    }

    public function delete(Sale $sale, ?int $userId = null): void
    {
        $sale->loadMissing(['linkedClient', 'commercial', 'linkedCarrier', 'linkedPartner']);
        $beforeSnapshot = array_merge(['id' => $sale->id], $this->activityLog->buildSaleSnapshot($sale));

        DB::transaction(function () use ($sale, $userId, $beforeSnapshot) {

            if ($this->statusAppliesStock($sale->status)) {
                $this->restoreStockForItems($sale, $userId);
            }

            // Remove this sale's own allocation(s). If a parent payment no longer
            // covers any other sale, delete the payment and its transaction too —
            // but a multi-sale client payment must survive for the other sales.
            $allocations = SalePaymentAllocation::where('sale_id', $sale->id)->get();
            foreach ($allocations->groupBy('payment_id') as $paymentId => $rows) {
                SalePaymentAllocation::whereIn('id', $rows->pluck('id'))->delete();

                if (SalePaymentAllocation::where('payment_id', $paymentId)->exists()) {
                    continue;
                }

                $payment = Payment::find($paymentId);
                if ($payment) {
                    if ($payment->transaction_id) {
                        Transaction::where('id', $payment->transaction_id)->delete();
                    }
                    $payment->delete();
                }
            }

            // Legacy fallback: payments still linked via sale_id but with no
            // allocation row (e.g. rows inserted directly, bypassing the service).
            $transactionIds = $sale->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $sale->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $sale->delete();

            $this->activityLog->logSaleDeleted($beforeSnapshot, $userId, ActivityLogService::resolveUserName($userId));
        });
    }

    protected function prepareSalePayload(array $validated, array $items, ?Sale $existingSale = null): array
    {
        $totals = $this->calculateTotals($items);

        $payload = Arr::except($validated, ['items']);
        $payload['client_id'] = $this->resolveClientId($validated, $existingSale);
        unset($payload['client'], $payload['client_phone']);

        $payload['total_quantity'] = $totals['total_quantity'];
        $payload['total_sale'] = $totals['total_sale'];
        $payload['total_purchase'] = $totals['total_purchase'];
        $payload['margin'] = $totals['margin'];

        if (Schema::hasColumn('sales', 'subtotal') && ! array_key_exists('subtotal', $payload)) {
            $payload['subtotal'] = $totals['total_sale'];
        }

        if (Schema::hasColumn('sales', 'date') && empty($payload['date']) && $existingSale?->date === null) {
            $payload['date'] = now();
        }

        if (Schema::hasColumn('sales', 'sale_date') && empty($payload['sale_date']) && $existingSale?->sale_date === null) {
            $payload['sale_date'] = now();
        }

        return $payload;
    }

    protected function prepareSalePayloadWithoutRecomputingTotals(array $validated, Sale $sale): array
    {
        $payload = Arr::except($validated, ['items']);
        $payload['client_id'] = $this->resolveClientId($validated, $sale);
        unset($payload['client'], $payload['client_phone']);

        if (Schema::hasColumn('sales', 'date') && empty($payload['date']) && $sale->date === null) {
            $payload['date'] = now();
        }

        if (Schema::hasColumn('sales', 'sale_date') && empty($payload['sale_date']) && $sale->sale_date === null) {
            $payload['sale_date'] = now();
        }

        return $payload;
    }

    protected function calculateTotals(array $items): array
    {
        $totalQuantity = 0;
        $totalSale = 0.0;
        $totalPurchase = 0.0;

        foreach ($items as $item) {
            $quantity = (int) ($item['quantity'] ?? 0);
            $unitPrice = $this->resolveUnitPrice($item);
            $lineTotal = $this->resolveLineTotal($item, $quantity, $unitPrice);
            $purchasePrice = round((float) ($item['purchase_price'] ?? 0), 2);

            $totalQuantity += $quantity;
            $totalSale += $lineTotal;
            $totalPurchase += $purchasePrice * $quantity;
        }

        return [
            'total_quantity' => $totalQuantity,
            'total_sale' => round($totalSale, 2),
            'total_purchase' => round($totalPurchase, 2),
            'margin' => round($totalSale - $totalPurchase, 2),
        ];
    }

    protected function persistItems(Sale $sale, array $items, ?int $userId = null, bool $applyStock = true): void
    {
        foreach ($items as $item) {
            $quantity = (int) ($item['quantity'] ?? 0);
            $unitPrice = $this->resolveUnitPrice($item);
            $lineTotal = $this->resolveLineTotal($item, $quantity, $unitPrice);

            $purchasePrice = round((float) ($item['purchase_price'] ?? 0), 2);
            $discount = round((float) ($item['discount'] ?? 0), 2);

            $payload = [
                'sale_id' => $sale->id,
                'stock_id' => $item['stock_id'] ?? null,
                'product_id' => $item['product_id'] ?? null,
                'quantity' => $quantity,
                'purchase_price' => $purchasePrice,
                'selling_price' => $unitPrice,
                'discount' => $discount,
                'total_purchase' => round($purchasePrice * $quantity, 2),
                'total_sale' => $lineTotal,
                'margin' => round($lineTotal - $purchasePrice * $quantity, 2),
            ];

            SaleItem::create($this->filterColumns('sale_items', $payload));

            if ($applyStock && ! empty($item['stock_id'])) {
                $stock = Stock::lockForUpdate()->find($item['stock_id']);
                if ($stock) {
                    $before = (int) $stock->quantity;
                    $stock->quantity = $before - $quantity;
                    $stock->save();
                    $clientName = $sale->client_id ? ($sale->linkedClient?->name ?? null) : null;
                    $reason = "Vente #{$sale->id}".($clientName ? " — {$clientName}" : '');
                    $this->movements->recordSaleOut(
                        $stock->id,
                        $stock->product_id,
                        $before,
                        (int) $stock->quantity,
                        $sale->id,
                        $userId,
                        $reason
                    );
                }
            }
        }
    }

    private function restoreStockForItems(Sale $sale, ?int $userId): void
    {
        foreach ($sale->items as $item) {
            if (! $item->stock_id) {
                continue;
            }

            $stock = Stock::lockForUpdate()->find($item->stock_id);
            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $stock->quantity = $before + (int) $item->quantity;
            $stock->save();

            $clientName = $sale->client_id ? ($sale->linkedClient?->name ?? null) : null;
            $reason = "Vente #{$sale->id}".($clientName ? " — {$clientName}" : '');
            $this->movements->recordSaleIn(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $sale->id,
                $userId,
                $reason
            );
        }
    }

    /**
     * Mirror of restoreStockForItems() for the reverse transition: a sale
     * reactivated from ANNULE (without its items being re-submitted) must
     * have its stock re-deducted, exactly as it was at the original sale.
     */
    private function applyStockForItems(Sale $sale, ?int $userId): void
    {
        foreach ($sale->items as $item) {
            if (! $item->stock_id) {
                continue;
            }

            $stock = Stock::lockForUpdate()->find($item->stock_id);
            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $stock->quantity = $before - (int) $item->quantity;
            $stock->save();

            $clientName = $sale->client_id ? ($sale->linkedClient?->name ?? null) : null;
            $reason = "Vente #{$sale->id}".($clientName ? " — {$clientName}" : '');
            $this->movements->recordSaleOut(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $sale->id,
                $userId,
                $reason
            );
        }
    }

    /**
     * Whether this sale status keeps its lines' stock deducted. Only ANNULE
     * releases the stock — mirrors PurchaseService::statusAppliesStock().
     */
    private function statusAppliesStock(?string $status): bool
    {
        return $status !== SaleStatus::ANNULE->value;
    }

    protected function resolveUnitPrice(array $item): float
    {
        foreach (['selling_price', 'unit_price', 'sale_price', 'price'] as $column) {
            if (array_key_exists($column, $item) && $item[$column] !== null) {
                return round((float) $item[$column], 2);
            }
        }

        if (! empty($item['stock_id'])) {
            $stock = Stock::find($item['stock_id']);

            if ($stock) {
                foreach (['sale_price', 'selling_price', 'price', 'unit_price'] as $column) {
                    if (isset($stock->{$column})) {
                        return round((float) $stock->{$column}, 2);
                    }
                }
            }
        }

        return 0.0;
    }

    protected function resolveLineTotal(array $item, int $quantity, float $unitPrice): float
    {
        foreach (['total_price', 'subtotal', 'total'] as $column) {
            if (array_key_exists($column, $item) && $item[$column] !== null) {
                return round((float) $item[$column], 2);
            }
        }

        return round($quantity * $unitPrice, 2);
    }

    protected function resolveClientId(array $validated, ?Sale $existingSale = null): ?int
    {
        if (array_key_exists('client_id', $validated) && $validated['client_id'] !== null) {
            return (int) $validated['client_id'];
        }

        $clientName = $this->normalizeString($validated['client'] ?? null);
        $clientPhone = $this->normalizeString($validated['client_phone'] ?? null);

        if ($clientName === null) {
            return array_key_exists('client_id', $validated) ? null : $existingSale?->client_id;
        }

        $clientQuery = Client::query()->where('name', $clientName);

        if ($clientPhone !== null) {
            $clientQuery->where('phone', $clientPhone);
        }

        $client = $clientQuery->first();

        if (! $client && $clientPhone !== null) {
            $client = Client::query()
                ->where('name', $clientName)
                ->whereNull('phone')
                ->first();
        }

        if (! $client) {
            $client = Client::create([
                'name' => $clientName,
                'phone' => $clientPhone,
                'city' => $this->normalizeString($validated['city'] ?? null),
                'created_by' => $validated['created_by'] ?? $existingSale?->created_by,
                'updated_by' => $validated['updated_by'] ?? $existingSale?->updated_by,
            ]);
        }

        return $client->id;
    }

    protected function normalizeString(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    protected function filterColumns(string $table, array $data): array
    {
        if (! Schema::hasTable($table)) {
            return $data;
        }

        $columns = Schema::getColumnListing($table);

        return array_filter(
            $data,
            fn ($value, $key) => in_array($key, $columns, true),
            ARRAY_FILTER_USE_BOTH
        );
    }
}
