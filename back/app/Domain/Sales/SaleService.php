<?php

namespace App\Domain\Sales;

use App\Models\Client;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Stock;
use App\Services\StockMovementService;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SaleService
{
    public function __construct(private StockMovementService $movements)
    {
    }

    public function create(array $validated, ?int $userId = null): Sale
    {
        return DB::transaction(function () use ($validated, $userId) {
            $items = $validated['items'] ?? [];

            $saleData = $this->prepareSalePayload($validated, $items);

            $sale = Sale::create($this->filterColumns('sales', $saleData));

            $this->persistItems($sale, $items, $userId);

            return $sale->fresh(['linkedClient', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);
        });
    }

    public function update(Sale $sale, array $validated, ?int $userId = null): Sale
    {
        return DB::transaction(function () use ($sale, $validated, $userId) {
            $items = $validated['items'] ?? null;

            $saleData = $items !== null
                ? $this->prepareSalePayload($validated, $items, $sale)
                : $this->prepareSalePayloadWithoutRecomputingTotals($validated, $sale);

            $sale->update($this->filterColumns('sales', $saleData));

            if ($items !== null) {
                $this->restoreStockForItems($sale, $userId);
                $sale->items()->delete();
                $this->persistItems($sale, $items, $userId);
            }

            return $sale->fresh(['linkedClient', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);
        });
    }

    public function delete(Sale $sale, ?int $userId = null): void
    {
        DB::transaction(function () use ($sale, $userId) {
            $this->restoreStockForItems($sale, $userId);
            $sale->delete();
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

    protected function persistItems(Sale $sale, array $items, ?int $userId = null): void
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

            if (! empty($item['stock_id'])) {
                $stock = Stock::lockForUpdate()->find($item['stock_id']);
                if ($stock) {
                    $before = (int) $stock->quantity;
                    $stock->quantity = $before - $quantity;
                    $stock->save();
                    $this->movements->recordSaleOut(
                        $stock->id,
                        $stock->product_id,
                        $before,
                        (int) $stock->quantity,
                        $sale->id,
                        $userId
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

            $this->movements->recordSaleIn(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $sale->id,
                $userId
            );
        }
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
