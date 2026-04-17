<?php

namespace App\Domain\Sales;

use App\Models\Brand;
use App\Models\Partner;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\User;
use App\Services\StockMovementService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SaleService
{
    /**
     * @var StockMovementService
     */
    protected $movements;

    public function __construct(StockMovementService $movements)
    {
        $this->movements = $movements;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = [])
    {
        $query = $this->buildFilteredQuery($filters);

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     */
    public function validateStock(array $itemsData): ?array
    {
        foreach ($itemsData as $itemIndex => $itemData) {
            if (empty($itemData['stock_id'])) {
                continue;
            }

            $stock = Stock::find($itemData['stock_id']);

            if (! $stock || $stock->quantity < ($itemData['quantity'] ?? 1)) {
                return [
                    'message' => 'Quantité insuffisante en stock.',
                    'errors' => [
                        "items.{$itemIndex}.stock_id" => ['Quantité insuffisante en stock. Disponible: ' . ($stock->quantity ?? 0)],
                    ],
                ];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function create(array $validated, int $userId): Sale
    {
        $itemsData = $validated['items'] ?? [];
        $totals = $this->calculateTotals($itemsData);

        $sale = DB::transaction(function () use ($validated, $itemsData, $totals, $userId) {
            $sale = Sale::create(array_merge(
                $this->withoutItems($validated),
                $totals,
                ['created_by' => $userId],
            ));

            $this->createItemsAndApplyStock($sale, $itemsData, (string) ($sale->status ?? $validated['status'] ?? 'EN COURS'), $userId);

            return $sale;
        });

        return $this->loadRelations($sale);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Sale $sale, array $validated, int $userId): Sale
    {
        $oldStatus = $sale->status;
        $itemsData = $validated['items'] ?? [];
        $totals = $this->calculateTotals($itemsData);

        DB::transaction(function () use ($sale, $validated, $itemsData, $totals, $userId, $oldStatus) {
            if ($oldStatus !== 'ANNULE') {
                $this->restoreStockForItems($sale, $userId);
            }

            $sale->items()->delete();

            $sale->update(array_merge(
                $this->withoutItems($validated),
                $totals,
                ['updated_by' => $userId],
            ));

            $newStatus = $validated['status'] ?? $oldStatus;

            $this->createItemsAndApplyStock($sale, $itemsData, $newStatus, $userId);
        });

        return $this->loadRelations($sale->fresh());
    }

    public function delete(Sale $sale, ?int $userId): void
    {
        DB::transaction(function () use ($sale, $userId) {
            if ($sale->status !== 'ANNULE') {
                $this->restoreStockForItems($sale, $userId);
            }

            $transactionIds = $sale->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $sale->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $sale->delete();
        });
    }

    /**
     * @return array<string, int|float>
     */
    public function summary(): array
    {
        $tyresThisMonth = Sale::whereYear('date', now()->year)
            ->whereMonth('date', now()->month)
            ->sum('total_quantity');

        $tyresToday = Sale::whereDate('date', now()->toDateString())
            ->sum('total_quantity');

        $enCoursQuery = Sale::where('status', 'EN COURS');
        $tyresEnCours = (clone $enCoursQuery)->sum('total_quantity');
        $salesEnCours = (clone $enCoursQuery)->count();

        $totalUnpaid = Sale::where('payment_status', 'NON PAYE')->sum('total_sale');

        return [
            'tyres_this_month' => (int) $tyresThisMonth,
            'tyres_today' => (int) $tyresToday,
            'tyres_en_cours' => (int) $tyresEnCours,
            'sales_en_cours' => (int) $salesEnCours,
            'total_unpaid' => round((float) $totalUnpaid, 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        return [
            'brands' => Brand::whereIn('id', function ($q) {
                $q->select('brand_id')
                    ->from('products')
                    ->whereIn('id', SaleItem::query()->whereNotNull('product_id')->select('product_id'));
            })
                ->orderBy('name')
                ->pluck('name')
                ->values(),
            'clients' => Sale::distinct()->whereNotNull('client')->pluck('client')->sort()->values(),
            'cities' => Sale::distinct()->whereNotNull('city')->pluck('city')->sort()->values(),
            'statuses' => Sale::distinct()->whereNotNull('status')->pluck('status')->sort()->values(),
            'payment_statuses' => Sale::distinct()->whereNotNull('payment_status')->pluck('payment_status')->sort()->values(),
            'partners' => Partner::pluck('name')->sort()->values(),
            'commercials' => User::role(['Commercial', 'Manager', 'Administrator'])->orderBy('name')->get(['id', 'name']),
        ];
    }

    public function loadRelations(Sale $sale): Sale
    {
        return $sale->load([
            'commercial',
            'carrier',
            'partner',
            'items.linkedProduct.brand',
            'items.linkedProduct.tyre',
            'items.linkedProduct.part',
            'items.linkedProduct.service',
            'items.stock',
            'creator',
            'updater',
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function buildFilteredQuery(array $filters): Builder
    {
        $query = Sale::query()->with([
            'commercial',
            'carrier',
            'partner',
            'items.linkedProduct.brand',
            'items.linkedProduct.tyre',
            'items.linkedProduct.part',
            'items.linkedProduct.service',
            'items.stock',
            'creator',
            'updater',
        ]);

        $sortable = ['date', 'client', 'total_quantity', 'total_sale', 'margin', 'payment_status', 'status', 'created_at', 'updated_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->latest('id');
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];

            $query->where(function ($q) use ($search) {
                $q->where('client', 'like', "%{$search}%")
                    ->orWhere('comments', 'like', "%{$search}%")
                    ->orWhereHas('items.linkedProduct', function ($q2) use ($search) {
                        $q2->where('profile', 'like', "%{$search}%")
                            ->orWhere('reference', 'like', "%{$search}%")
                            ->orWhereHas('brand', function ($q3) use ($search) {
                                $q3->where('name', 'like', "%{$search}%");
                            });
                    });
            });
        }

        if (! empty($filters['brand'])) {
            $query->whereHas('items.linkedProduct.brand', function ($q) use ($filters) {
                $q->where('name', $filters['brand']);
            });
        }

        foreach (['city', 'payment_method', 'status', 'payment_status'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        if (! empty($filters['client'])) {
            $query->where('client', 'like', '%' . $filters['client'] . '%');
        }

        if (! empty($filters['commercial_id'])) {
            $query->where('commercial_id', $filters['commercial_id']);
        }

        if (! empty($filters['partner'])) {
            $query->whereHas('partner', function ($q) use ($filters) {
                $q->where('name', $filters['partner']);
            });
        }

        if (! empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to']);
        }

        return $query;
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     * @return array<string, int|float>
     */
    private function calculateTotals(array $itemsData): array
    {
        $totalQuantity = 0;
        $totalPurchase = 0;
        $totalSale = 0;

        foreach ($itemsData as $itemData) {
            $qte = $itemData['quantity'] ?? 1;
            $purchasePrice = (float) ($itemData['purchase_price'] ?? 0);
            $sellingPrice = (float) ($itemData['selling_price'] ?? 0);
            $discount = max(0.0, min(100.0, (float) ($itemData['discount'] ?? 0)));
            $lineSale = $sellingPrice * $qte * (1 - $discount / 100);

            $totalQuantity += $qte;
            $totalPurchase += $purchasePrice * $qte;
            $totalSale += $lineSale;
        }

        return [
            'total_quantity' => $totalQuantity,
            'total_purchase' => $totalPurchase,
            'total_sale' => $totalSale,
            'margin' => $totalSale - $totalPurchase,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function withoutItems(array $validated): array
    {
        unset($validated['items']);

        return $validated;
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     */
    private function createItemsAndApplyStock(Sale $sale, array $itemsData, string $status, ?int $userId): void
    {
        foreach ($itemsData as $itemData) {
            $qte = $itemData['quantity'] ?? 1;
            $purchasePrice = (float) ($itemData['purchase_price'] ?? 0);
            $sellingPrice = (float) ($itemData['selling_price'] ?? 0);
            $discount = max(0.0, min(100.0, (float) ($itemData['discount'] ?? 0)));
            $lineSale = $sellingPrice * $qte * (1 - $discount / 100);
            $totalPurchase = $purchasePrice * $qte;

            $sale->items()->create([
                'product_id' => $itemData['product_id'],
                'stock_id' => $itemData['stock_id'] ?? null,
                'quantity' => $qte,
                'purchase_price' => $purchasePrice,
                'selling_price' => $sellingPrice,
                'discount' => $discount,
                'total_purchase' => $totalPurchase,
                'total_sale' => $lineSale,
                'margin' => $lineSale - $totalPurchase,
            ]);

            if ($status === 'ANNULE' || empty($itemData['stock_id'])) {
                continue;
            }

            $stock = Stock::lockForUpdate()->find($itemData['stock_id']);

            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $stock->quantity = $before - $qte;
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
}
