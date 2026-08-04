<?php

namespace App\Domain\Purchases;

use App\Domain\Support\StatusTransitionGuard;
use App\Enums\PurchasePaymentStatus;
use App\Enums\PurchaseStatus;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\StockMovementService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    protected StockMovementService $movements;

    protected ActivityLogService $activityLog;

    protected PurchasePaymentService $purchasePayments;

    public function __construct(StockMovementService $movements, ActivityLogService $activityLog, PurchasePaymentService $purchasePayments)
    {
        $this->movements = $movements;
        $this->activityLog = $activityLog;
        $this->purchasePayments = $purchasePayments;
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
        $discount = (float) ($validated['discount'] ?? 0);
        $totals = $this->calculateTotals($itemsData, $discount);

        $purchase = DB::transaction(function () use ($validated, $itemsData, $totals, $userId) {
            $purchase = Purchase::create(array_merge(
                $this->withoutItems($validated),
                $totals,
                // A new purchase always starts at the first step of the workflow —
                // any other status submitted at creation time is ignored.
                ['status' => PurchaseStatus::EN_COURS->value],
                ['created_by' => $userId]
            ));

            $this->createItemsAndApplyStock($purchase, $itemsData, $purchase->status, $userId);

            return $purchase;
        });

        $loaded = $this->loadRelations($purchase);

        $snapshot = $this->activityLog->buildPurchaseSnapshot($loaded);
        $this->activityLog->logPurchaseCreated($loaded, $snapshot, $userId, ActivityLogService::resolveUserName($userId));

        return $loaded;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Purchase $purchase, array $validated, $userId, bool $isAdmin = false)
    {
        $oldStatus = $purchase->status;
        $newStatus = $validated['status'] ?? $oldStatus;

        StatusTransitionGuard::assert($oldStatus, $newStatus, PurchaseStatus::allowedTransitions(), $isAdmin, "l'achat");

        $itemsData = $validated['items'] ?? [];
        $discount = (float) ($validated['discount'] ?? 0);
        $totals = $this->calculateTotals($itemsData, $discount);

        $purchase->loadMissing(['supplier', 'commercial']);
        $beforeSnapshot = $this->activityLog->buildPurchaseSnapshot($purchase);

        DB::transaction(function () use ($purchase, $validated, $itemsData, $totals, $userId, $oldStatus) {
            if ($this->statusAppliesStock($oldStatus)) {
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

        $loaded = $this->loadRelations($purchase->fresh());

        $this->refreshPaymentStatus($loaded);
        $loaded->refresh();

        $afterSnapshot = $this->activityLog->buildPurchaseSnapshot($loaded);
        $this->activityLog->logPurchaseUpdated($loaded, $beforeSnapshot, $afterSnapshot, $userId, ActivityLogService::resolveUserName($userId));

        return $loaded;
    }

    public function patchStatus(Purchase $purchase, string $status, $userId, bool $isAdmin = false): void
    {
        $purchase->loadMissing(['supplier', 'commercial', 'items']);
        $before = $this->activityLog->buildPurchaseSnapshot($purchase);
        $oldStatus = $purchase->status;

        StatusTransitionGuard::assert($oldStatus, $status, PurchaseStatus::allowedTransitions(), $isAdmin, "l'achat");

        DB::transaction(function () use ($purchase, $status, $oldStatus, $userId) {
            $wasApplied = $this->statusAppliesStock($oldStatus);
            $willApply = $this->statusAppliesStock($status);

            if ($wasApplied && ! $willApply) {
                $this->restoreStockForItems($purchase, $userId);
            } elseif (! $wasApplied && $willApply) {
                $this->applyStockForItems($purchase, $userId);
            }

            $purchase->update(['status' => $status]);
        });

        $after = $this->activityLog->buildPurchaseSnapshot($purchase->fresh(['supplier', 'commercial']));
        $this->activityLog->logPurchaseUpdated(
            $purchase,
            $before,
            $after,
            $userId,
            ActivityLogService::resolveUserName($userId),
        );
    }

    private function statusAppliesStock(?string $status): bool
    {
        return $status !== PurchaseStatus::ANNULE->value;
    }

    private function refreshPaymentStatus(Purchase $purchase): void
    {
        $totalPaid = $purchase->paidAmount();
        $netAmount = (float) $purchase->net_amount;
        $status = $totalPaid <= 0
                ? PurchasePaymentStatus::NON_PAYE->value
                : ($totalPaid >= $netAmount ? PurchasePaymentStatus::PAYE->value : PurchasePaymentStatus::PARTIEL->value);
        $purchase->update(['payment_status' => $status]);
    }

    public function delete(Purchase $purchase, $userId)
    {
        $purchase->loadMissing(['supplier', 'commercial']);
        $beforeSnapshot = array_merge(['id' => $purchase->id], $this->activityLog->buildPurchaseSnapshot($purchase));

        DB::transaction(function () use ($purchase, $userId) {
            if ($this->statusAppliesStock($purchase->status)) {
                $this->restoreStockForItems($purchase, $userId);
            }

            // Remove this purchase's own allocation(s). If a parent payment no longer
            // covers any other purchase, delete the payment and its transaction too —
            // but a multi-purchase supplier payment must survive for the other purchases.
            $allocations = PurchasePaymentAllocation::where('purchase_id', $purchase->id)->get();
            foreach ($allocations->groupBy('purchase_payment_id') as $paymentId => $rows) {
                PurchasePaymentAllocation::whereIn('id', $rows->pluck('id'))->delete();

                if (PurchasePaymentAllocation::where('purchase_payment_id', $paymentId)->exists()) {
                    continue;
                }

                $payment = PurchasePayment::find($paymentId);
                if ($payment) {
                    if ($payment->transaction_id) {
                        Transaction::where('id', $payment->transaction_id)->delete();
                    }
                    $payment->delete();
                }
            }

            // Legacy fallback: payments still linked via purchase_id but with no
            // allocation row (e.g. rows inserted directly, bypassing the service).
            $transactionIds = $purchase->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $purchase->payments()->delete();

            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $purchase->delete();
        });

        $this->activityLog->logPurchaseDeleted($beforeSnapshot, $userId, ActivityLogService::resolveUserName($userId));
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
        } else {
            // No explicit status filter: cancelled purchases must not inflate the KPI cards.
            $query->where('status', '!=', PurchaseStatus::ANNULE->value);
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
        if (isset($filters['with_invoice']) && $filters['with_invoice'] !== '') {
            $query->where('with_invoice', filter_var($filters['with_invoice'], FILTER_VALIDATE_BOOLEAN));
        }
        if (isset($filters['amount_min']) && $filters['amount_min'] !== '') {
            $query->where('net_amount', '>=', (float) $filters['amount_min']);
        }
        if (isset($filters['amount_max']) && $filters['amount_max'] !== '') {
            $query->where('net_amount', '<=', (float) $filters['amount_max']);
        }

        $totalAchats = (clone $query)->sum('net_amount') ?? 0;
        $totalPaye = (clone $query)->where('payment_status', PurchasePaymentStatus::PAYE->value)->sum('net_amount') ?? 0;
        $resteAPayer = $totalAchats - $totalPaye;

        $unpaidEnCours = (function () use ($query): float {
            $q = (clone $query)
                ->where('status', PurchaseStatus::EN_COURS->value)
                ->whereIn('payment_status', [PurchasePaymentStatus::NON_PAYE->value, PurchasePaymentStatus::PARTIEL->value]);
            $totalSale = (float) (clone $q)->sum('net_amount');
            $totalPaid = (float) \DB::table('purchase_payment_allocations')
                ->whereIn('purchase_id', (clone $q)->select('id'))
                ->sum('amount');

            return round($totalSale - $totalPaid, 2);
        })();

        $unpaidRecuTermine = (function () use ($query): float {
            $q = (clone $query)
                ->whereIn('status', [PurchaseStatus::RECU->value, PurchaseStatus::TERMINE->value])
                ->whereIn('payment_status', [PurchasePaymentStatus::NON_PAYE->value, PurchasePaymentStatus::PARTIEL->value]);
            $totalSale = (float) (clone $q)->sum('net_amount');
            $totalPaid = (float) \DB::table('purchase_payment_allocations')
                ->whereIn('purchase_id', (clone $q)->select('id'))
                ->sum('amount');

            return round($totalSale - $totalPaid, 2);
        })();

        return [
            'total_achats' => round((float) $totalAchats, 2),
            'total_paye' => round((float) $totalPaye, 2),
            'reste_a_payer' => round((float) $resteAPayer, 2),
            'unpaid_en_cours' => $unpaidEnCours,
            'unpaid_recu_termine' => $unpaidRecuTermine,
            'ca_avec_facture' => round((float) (clone $query)->where('with_invoice', true)->sum('net_amount'), 2),
            'ca_sans_facture' => round((float) (clone $query)->where('with_invoice', false)->sum('net_amount'), 2),
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
        $purchase->load([
            'items.linkedProduct.brand',
            'items.linkedProduct.tyre',
            'items.linkedProduct.part',
            'items.linkedProduct.service',
            'supplier',
            'commercial',
            'creator',
            'updater',
            'allocations.payment',
        ]);

        // Built from allocations (not the legacy `payments` relation) so a purchase
        // covered by a multi-purchase supplier payment still shows its own share.
        $purchase->setRelation('payments', $this->purchasePayments->buildPaymentRowsForPurchase($purchase));

        return $purchase;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function buildFilteredQuery(array $filters): Builder
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
            'allocations.payment',
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
                    })
                    ->orWhere('bl_number', 'like', "%{$search}%")
                    ->orWhere('invoice_number', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['payment_status'])) {
            $query->where('payment_status', $filters['payment_status']);
        }
        // Repointed at the actual recorded payments — never the legacy `payments`
        // relation, which misses multi-purchase supplier payments.
        if (! empty($filters['payment_method'])) {
            $method = $filters['payment_method'];
            $query->whereHas('allocations.payment', fn ($q) => $q->where('method', $method));
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
        if (isset($filters['with_invoice']) && $filters['with_invoice'] !== '') {
            $query->where('with_invoice', filter_var($filters['with_invoice'], FILTER_VALIDATE_BOOLEAN));
        }
        if (isset($filters['amount_min']) && $filters['amount_min'] !== '') {
            $query->where('net_amount', '>=', (float) $filters['amount_min']);
        }
        if (isset($filters['amount_max']) && $filters['amount_max'] !== '') {
            $query->where('net_amount', '<=', (float) $filters['amount_max']);
        }

        return $query;
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     * @return array<string, int|float>
     */
    protected function calculateTotals(array $itemsData, float $discount = 0.0): array
    {
        $totalQuantity = 0;
        $totalPrice = 0.0;

        foreach ($itemsData as $itemData) {
            $quantity = $itemData['quantity'] ?? 1;
            $unitPrice = (float) ($itemData['unit_price'] ?? 0);

            $totalQuantity += $quantity;
            $totalPrice += $unitPrice * $quantity;
        }

        $discountAmount = $totalPrice * ($discount / 100);

        return [
            'total_quantity' => $totalQuantity,
            'total_price' => round($totalPrice, 2),
            'net_amount' => max(0, round($totalPrice - $discountAmount, 2)),
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

            if (! $this->statusAppliesStock($status)) {
                continue;
            }

            $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
            if (! $stock) {
                continue;
            }

            $before = (int) $stock->quantity;
            $stock->quantity = $before + $quantity;
            $stock->save();

            $supplierName = $purchase->supplier?->name ?? null;
            $reason = "Achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : '');
            $this->movements->recordPurchaseIn(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $purchase->id,
                $userId,
                $reason
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

            $supplierName = $purchase->supplier?->name ?? null;
            $reason = "Achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : '');
            $this->movements->recordPurchaseOut(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $purchase->id,
                $userId,
                $reason
            );
        }
    }

    protected function applyStockForItems(Purchase $purchase, $userId)
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
            $stock->quantity = $before + (int) $item->quantity;
            $stock->save();

            $supplierName = $purchase->supplier?->name ?? null;
            $reason = "Achat #{$purchase->id}".($supplierName ? " — {$supplierName}" : '');
            $this->movements->recordPurchaseIn(
                $stock->id,
                $stock->product_id,
                $before,
                (int) $stock->quantity,
                $purchase->id,
                $userId,
                $reason
            );
        }
    }
}
