<?php

namespace App\Domain\Sales;

use App\Models\Client;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Stock;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SaleService
{
    public function create(array $validated): Sale
    {
        return DB::transaction(function () use ($validated) {
            $items = $validated['items'] ?? [];

            $saleData = $this->prepareSalePayload($validated, $items);

            $sale = Sale::create($this->filterColumns('sales', $saleData));

            $this->persistItems($sale, $items);

            return $sale->fresh(['linkedClient', 'commercial', 'items', 'payments']);
        });
    }

    public function update(Sale $sale, array $validated): Sale
    {
        return DB::transaction(function () use ($sale, $validated) {
            $items = $validated['items'] ?? null;

            $saleData = $items !== null
                ? $this->prepareSalePayload($validated, $items, $sale)
                : $this->prepareSalePayloadWithoutRecomputingTotals($validated, $sale);

            $sale->update($this->filterColumns('sales', $saleData));

            if ($items !== null) {
                $sale->items()->delete();
                $this->persistItems($sale, $items);
            }

            return $sale->fresh(['linkedClient', 'commercial', 'items', 'payments']);
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

        foreach ($items as $item) {
            $quantity = (int) ($item['quantity'] ?? 0);
            $unitPrice = $this->resolveUnitPrice($item);
            $lineTotal = $this->resolveLineTotal($item, $quantity, $unitPrice);

            $totalQuantity += $quantity;
            $totalSale += $lineTotal;
        }

        return [
            'total_quantity' => $totalQuantity,
            'total_sale' => round($totalSale, 2),
        ];
    }

    protected function persistItems(Sale $sale, array $items): void
    {
        foreach ($items as $item) {
            $quantity = (int) ($item['quantity'] ?? 0);
            $unitPrice = $this->resolveUnitPrice($item);
            $lineTotal = $this->resolveLineTotal($item, $quantity, $unitPrice);

            $payload = [
                'sale_id' => $sale->id,
                'stock_id' => $item['stock_id'] ?? null,
                'product_id' => $item['product_id'] ?? null,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => $lineTotal,
                'subtotal' => $lineTotal,
            ];

            SaleItem::create($this->filterColumns('sale_items', $payload));
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
