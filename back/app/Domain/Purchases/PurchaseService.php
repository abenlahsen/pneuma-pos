<?php

namespace App\Domain\Purchases;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Services\StockMovementService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    protected $movements;

    public function __construct($movements)
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
     * @param  array<int, array<string, mixed>>  $items
     * @return array<string, mixed>|null
     */
    public function rejectServicePurchases(array $items)
    {
        $productIds = collect($items)->pluck('product_id')->filter()->unique()->values();
        $serviceIds = Product::whereIn('id', $productIds)
            ->where('type', 'service')
            ->pluck('id');

        if ($serviceIds->isEmpty()) {
            return null;
        }

        $errors = [];
        foreach ($items as $i => $item) {
            if ($serviceIds->contains($item['product_id'] ?? null)) {
                $errors["items.{$i}.product_id"] = ['Les services ne peuvent pas être achetés.'];
            }
        }

        return [
            'message' => 'Les services ne peuvent pas figurer dans un achat.',
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function create(array $validated, $userId)
    {
        $itemsData = $validated['items'] ?? [];
        $totals = $this->calculateTotals($itemsData);

        $purchase = DB::transaction(function () use ($validated, $itemsData, $totals, $userId) {
            $purchase = Purchase::create(array_merge(
                $this->withoutItems($validated),
                $totals,
                ['created_by' => $userId]
            ));

            $this->createItemsAndApplyStock($purchase, $itemsData, $purchase->status, $userId);

            return $purchase;
        });

        return $this->loadRelations($purchase);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Purchase $purchase, array $validated, $userId)
    {
        $oldStatus = $purchase->status;
        $itemsData = $validated['items'] ?? [];
        $totals = $this->calculateTotals($itemsData);

        DB::transaction(function () use ($purchase, $validated, $itemsData, $totals, $userId, $oldStatus) {
            if (! in_array($oldStatus, ['ANNULE', 'RETOUR'], true)) {
                $this->restoreStockForItems($purchase, $userId);
            }

            $purchase->items()->delete();

            $purchase->update(array_merge(
                $this->withoutItems($validated),
                $totals,
                ['updated_by' => $userId]
            ));

            $newStatus = $validated['status'] ?? $oldStatus;

            $this->createItemsAndApplyStock($purchase, $itemsData, $newStatus, $userId);
        });

        return $this->loadRelations($purchase->fresh());
    }

    public function delete(Purchase $purchase, $userId)
    {
        DB::transaction(function () use ($purchase, $userId) {
            if (! in_array($purchase->status, ['ANNULE', 'RETOUR'], true)) {
                $this->restoreStockForItems($purchase, $userId);
            }

            $transactionIds = $purchase->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $purchase->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $purchase->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, float>
     */
    public function summary(array $filters = [])
    {
        $query = Purchase::query();

        if (! empty($filters['payment_status'])) {
            $query->where('payment_status', $filters['payment_status']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_id', $filters['supplier_id']);
        }
        if (! empty($filters['commercial_id'])) {
            $query->where('commercial_id', $filters['commercial_id']);
        }
        if (! empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to']);
        }

        $totalAchats = (clone $query)->sum('total_price') ?? 0;
        $totalPaye = (clone $query)->where('payment_status', 'PAYE')->sum('total_price') ?? 0;
        $resteAPayer = $totalAchats - $totalPaye;

        return [
            'total_achats' => round((float) $totalAchats, 2),
            'total_paye' => round((float) $totalPaye, 2),
            'reste_a_payer' => round((float) $resteAPayer, 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function filters()
    {
        return [
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name']),
            'commercials' => User::role(['Commercial', 'Manager', 'Administrator'])->orderBy('name')->get(['id', 'name']),
        ];
    }

    public function loadRelations(Purchase $purchase)
    {
        return $purchase->load([
            'items.linkedProduct.brand',
            'items.linkedProduct.tyre',
            'items.linkedProduct.part',
            'items.linkedProduct.service',
            'supplier',
            'commercial',
            'creator',
            'updater',
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function buildFilteredQuery(array $filters): Builder
    {
        $query = Purchase::with([
            'supplier',
            'commercial',
            'items.linkedProduct.brand',
            'items.linkedProduct.tyre',
            'items.linkedProduct.part',
            'items.linkedProduct.service',
            'creator',
            'updater',
        ]);

        $sortable = ['date', 'total_quantity', 'total_price', 'payment_status', 'status', 'created_at', 'updated_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->latest();
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->whereHas('supplier', function ($q2) use ($search) {
                    $q2->where('name', 'like', "%{$search}%");
                })
                    ->orWhereHas('commercial', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('items.linkedProduct', function ($q2) use ($search) {
                        $q2->where('profile', 'like', "%{$search}%")
                            ->orWhere('reference', 'like', "%{$search}%")
                            ->orWhereHas('brand', function ($q3) use ($search) {
                                $q3->where('name', 'like', "%{$search}%");
                            });
                    });
            });
        }

        if (! empty($filters['payment_status'])) {
            $query->where('payment_status', $filters['payment_status']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_id', $filters['supplier_id']);
        }
        if (! empty($filters['commercial_id'])) {
            $query->where('commercial_id', $filters['commercial_id']);
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
    protected function calculateTotals(array $itemsData)
    {
        $totalQuantity = 0;
        $totalPrice = 0;

        foreach ($itemsData as $itemData) {
            $quantity = $itemData['quantity'] ?? 1;
            $unitPrice = (float) ($itemData['unit_price'] ?? 0);

            $totalQuantity += $quantity;
            $totalPrice += $unitPrice * $quantity;
        }

        return [
            'total_quantity' => $totalQuantity,
            'total_price' => $totalPrice,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function withoutItems(array $validated)
    {
        unset($validated['items']);

        return $validated;
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     */
    protected function createItemsAndApplyStock(Purchase $purchase, array $itemsData, $status, $userId)
    {
        foreach ($itemsData as $itemData) {
            $quantity = $itemData['quantity'] ?? 1;
            $unitPrice = (float) ($itemData['unit_price'] ?? 0);

            $purchase->items()->create([
                'product_id' => $itemData['product_id'],
                'stock_id' => $itemData['stock_id'],
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
            ]);

            if (in_array($status, ['ANNULE', 'RETOUR'], true)) {
                continue;
            }

            $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $stock->quantity = $before + $quantity;
            $stock->save();

            $this->movements->recordPurchaseIn(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $purchase->id,
                $userId
            );
        }
    }

    protected function restoreStockForItems(Purchase $purchase, $userId)
    {
        foreach ($purchase->items as $item) {
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

            $this->movements->recordPurchaseOut(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $purchase->id,
                $userId
            );
        }
    }
}
