<?php

namespace App\Domain\Purchases;

use App\Enums\PurchasePaymentStatus;
use App\Enums\PurchaseStatus;
use App\Models\ActivityLog;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchasePaymentService
{
    public function __construct(private ActivityLogService $activityLog) {}

    public function listForPurchase(Purchase $purchase): array
    {
        $rows = $this->buildPaymentRowsForPurchase($purchase);

        $totalPaid = (float) $rows->sum('amount');
        $totalPurchase = (float) ($purchase->net_amount ?? $purchase->total_price ?? 0);
        $remaining = max(0, $totalPurchase - $totalPaid);

        return [
            'payments' => $rows,
            'total_paid' => round($totalPaid, 2),
            'total_purchase' => round($totalPurchase, 2),
            'remaining' => round($remaining, 2),
            'payment_status' => $purchase->payment_status,
        ];
    }

    /**
     * Full breakdown of a payment: its own info plus every purchase it covers
     * (one entry per allocation, single or multi-purchase). Used by the
     * "view payment" modal to link back to each purchase.
     */
    public function getPaymentDetail(PurchasePayment $payment): array
    {
        $payment->load(['supplier', 'transaction.account', 'allocations.purchase']);

        return [
            'id' => $payment->id,
            'date' => $payment->date,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'created_at' => $payment->created_at,
            'supplier' => $payment->supplier ? [
                'id' => $payment->supplier->id,
                'name' => $payment->supplier->name,
            ] : null,
            'account' => $payment->transaction?->account ? [
                'id' => $payment->transaction->account->id,
                'name' => $payment->transaction->account->name,
            ] : null,
            'purchases' => $payment->allocations->map(fn (PurchasePaymentAllocation $allocation) => [
                'id' => $allocation->purchase->id,
                'date' => $allocation->purchase->date?->toDateString(),
                'net_amount' => (float) ($allocation->purchase->net_amount ?? $allocation->purchase->total_price ?? 0),
                'status' => $allocation->purchase->status,
                'payment_status' => $allocation->purchase->payment_status,
                'allocated_amount' => (float) $allocation->amount,
            ])->values(),
        ];
    }

    /**
     * Build the payment rows to display for a single purchase, one row per
     * allocation. Each row is shaped like the legacy PurchasePayment resource
     * (id = parent payment id, amount = the portion allocated to this purchase)
     * so the existing frontend keeps working unchanged. A `multi` flag marks
     * rows whose parent payment also covers other purchases.
     */
    public function buildPaymentRowsForPurchase(Purchase $purchase)
    {
        $allocations = $purchase->allocations()
            ->with(['payment' => function ($q) {
                $q->withCount('allocations')->with('transaction.account');
            }])
            ->get();

        return $allocations->map(function (PurchasePaymentAllocation $allocation) use ($purchase) {
            $payment = $allocation->payment;

            return (object) [
                'id' => $payment->id,
                'allocation_id' => $allocation->id,
                'purchase_id' => $purchase->id,
                'transaction_id' => $payment->transaction_id,
                'amount' => (float) $allocation->amount,
                'date' => $payment->date,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'account_id' => $payment->transaction?->account_id,
                'transaction' => $payment->transaction,
                'created_at' => $payment->created_at,
                'multi' => ($payment->allocations_count ?? 1) > 1,
            ];
        })->sortByDesc('date')->values();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function createPayment(Purchase $purchase, array $validated, User $user): PurchasePayment
    {
        $purchase->loadMissing('supplier');
        $supplierName = $purchase->supplier?->name ?? '';

        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'expense',
            'category' => 'Achat',
            'method' => $validated['method'],
            'description' => "Paiement achat #{$purchase->id} - {$purchase->total_quantity} pneus - {$supplierName}",
            'person' => $supplierName,
            'user_id' => $user->id,
            'account_id' => $validated['account_id'],
        ]);

        $payment = PurchasePayment::create([
            'purchase_id' => $purchase->id,
            'supplier_id' => $purchase->supplier_id,
            'transaction_id' => $transaction->id,
            'user_id' => $user->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $validated['method'],
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        PurchasePaymentAllocation::create([
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $purchase->id,
            'amount' => $validated['amount'],
        ]);

        $this->refreshPaymentStatus($purchase);

        $this->activityLog->logPaymentAdded(
            ActivityLog::ENTITY_ACHAT,
            $purchase->id,
            "Achat #{$purchase->id}",
            (float) $validated['amount'],
            $validated['method'],
            $validated['reference'] ?? null,
            $user->id,
            $user->name,
        );

        return $payment->load('transaction.account');
    }

    /**
     * Create a single payment split across several purchases belonging to the
     * same supplier ("Régler des achats" flow on the supplier profile page).
     *
     * @param  array<string, mixed>  $validated  amount, method, date, account_id, reference?, notes?,
     *                                           allocations: array<{purchase_id: int, amount: float}>
     */
    public function createSupplierPayment(Supplier $supplier, array $validated, User $user): PurchasePayment
    {
        $allocationsInput = collect($validated['allocations'] ?? [])
            ->filter(fn ($row) => (float) ($row['amount'] ?? 0) > 0)
            ->values();

        if ($allocationsInput->isEmpty()) {
            throw ValidationException::withMessages([
                'allocations' => ['Veuillez répartir le montant sur au moins un achat.'],
            ]);
        }

        $purchaseIds = $allocationsInput->pluck('purchase_id')->all();
        $purchases = Purchase::whereIn('id', $purchaseIds)->get()->keyBy('id');

        $sumAllocated = round((float) $allocationsInput->sum('amount'), 2);
        $amount = round((float) $validated['amount'], 2);

        if (abs($sumAllocated - $amount) > 0.01) {
            throw ValidationException::withMessages([
                'amount' => ["La répartition ({$sumAllocated} DH) ne correspond pas au montant du paiement ({$amount} DH)."],
            ]);
        }

        foreach ($allocationsInput as $row) {
            $purchase = $purchases->get($row['purchase_id']);

            if (! $purchase || (int) $purchase->supplier_id !== (int) $supplier->id) {
                throw ValidationException::withMessages([
                    'allocations' => ["L'achat #{$row['purchase_id']} n'appartient pas à ce fournisseur."],
                ]);
            }

            $remaining = round((float) ($purchase->net_amount ?? $purchase->total_price ?? 0) - $purchase->paidAmount(), 2);
            if (round((float) $row['amount'], 2) - $remaining > 0.01) {
                throw ValidationException::withMessages([
                    'allocations' => ["Le montant affecté à l'achat #{$purchase->id} dépasse son solde restant ({$remaining} DH)."],
                ]);
            }
        }

        return DB::transaction(function () use ($validated, $allocationsInput, $purchases, $supplier, $user, $amount) {
            $transaction = Transaction::create([
                'date' => $validated['date'],
                'amount' => $amount,
                'type' => 'expense',
                'category' => 'Achat',
                'method' => $validated['method'],
                'description' => "Règlement fournisseur {$supplier->name} — {$allocationsInput->count()} achat(s)",
                'person' => $supplier->name,
                'user_id' => $user->id,
                'account_id' => $validated['account_id'],
            ]);

            $payment = PurchasePayment::create([
                'purchase_id' => null,
                'supplier_id' => $supplier->id,
                'transaction_id' => $transaction->id,
                'user_id' => $user->id,
                'amount' => $amount,
                'date' => $validated['date'],
                'method' => $validated['method'],
                'reference' => $validated['reference'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($allocationsInput as $row) {
                PurchasePaymentAllocation::create([
                    'purchase_payment_id' => $payment->id,
                    'purchase_id' => $row['purchase_id'],
                    'amount' => round((float) $row['amount'], 2),
                ]);

                $purchase = $purchases->get($row['purchase_id']);
                $this->refreshPaymentStatus($purchase);

                $this->activityLog->logPaymentAdded(
                    ActivityLog::ENTITY_ACHAT,
                    $purchase->id,
                    "Achat #{$purchase->id}",
                    round((float) $row['amount'], 2),
                    $validated['method'],
                    $validated['reference'] ?? null,
                    $user->id,
                    $user->name,
                );
            }

            return $payment->load(['transaction.account', 'allocations.purchase']);
        });
    }

    /**
     * Purchases still owing money for a supplier, oldest first — used to feed
     * the "Régler des achats" allocation UI.
     */
    public function unpaidPurchasesForSupplier(Supplier $supplier)
    {
        return $supplier->purchases()
            ->where('status', '!=', PurchaseStatus::ANNULE->value)
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->map(fn (Purchase $purchase) => [
                'id' => $purchase->id,
                'date' => $purchase->date?->toDateString(),
                'net_amount' => round((float) ($purchase->net_amount ?? $purchase->total_price ?? 0), 2),
                'paid_amount' => round($purchase->paidAmount(), 2),
                'remaining' => round(max(0, (float) ($purchase->net_amount ?? $purchase->total_price ?? 0) - $purchase->paidAmount()), 2),
                'with_invoice' => (bool) $purchase->with_invoice,
            ])
            ->filter(fn ($row) => $row['remaining'] > 0.01)
            ->values();
    }

    public function deletePayment(Purchase $purchase, PurchasePayment $payment, ?int $userId = null, ?string $userName = null): void
    {
        $allocation = PurchasePaymentAllocation::where('purchase_payment_id', $payment->id)
            ->where('purchase_id', $purchase->id)
            ->first();

        if (! $allocation) {
            abort(404);
        }

        $totalAllocations = PurchasePaymentAllocation::where('purchase_payment_id', $payment->id)->count();

        if ($totalAllocations > 1) {
            abort(422, 'Ce paiement couvre plusieurs achats. Supprimez-le depuis la fiche du fournisseur.');
        }

        $amount = (float) $payment->amount;
        $method = $payment->method ?? '';

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($purchase->fresh());

        $this->activityLog->logPaymentDeleted(
            ActivityLog::ENTITY_ACHAT,
            $purchase->id,
            "Achat #{$purchase->id}",
            $amount,
            $method,
            $userId,
            $userName,
        );
    }

    /**
     * Fully delete a (possibly multi-purchase) payment: removes the transaction,
     * the payment, all its allocations, and refreshes every affected purchase.
     * Used from the supplier profile page.
     */
    public function deleteSupplierPayment(Supplier $supplier, PurchasePayment $payment, ?int $userId = null, ?string $userName = null): void
    {
        if ((int) $payment->supplier_id !== (int) $supplier->id) {
            abort(404);
        }

        $this->deletePaymentAndRefresh($payment, $userId, $userName);
    }

    /**
     * Fully delete a payment (single or multi-purchase): removes the transaction,
     * the payment, all its allocations (cascade), and recomputes payment_status
     * on every purchase it covered — even ones that were already fully paid. Used
     * both by the supplier-profile deletion flow and by the Cash Flow module
     * when deleting a transaction that happens to be linked to a payment.
     */
    public function deletePaymentAndRefresh(PurchasePayment $payment, ?int $userId = null, ?string $userName = null): void
    {
        $method = $payment->method ?? '';
        $allocations = $payment->allocations()->get(['purchase_id', 'amount']);
        $affectedPurchases = Purchase::whereIn('id', $allocations->pluck('purchase_id'))->get()->keyBy('id');

        DB::transaction(function () use ($payment) {
            if ($payment->transaction_id) {
                Transaction::where('id', $payment->transaction_id)->delete();
            }

            $payment->delete();
        });

        foreach ($allocations as $allocation) {
            $purchase = $affectedPurchases->get($allocation->purchase_id);
            if (! $purchase) {
                continue;
            }

            $this->refreshPaymentStatus($purchase->fresh());

            $this->activityLog->logPaymentDeleted(
                ActivityLog::ENTITY_ACHAT,
                $purchase->id,
                "Achat #{$purchase->id}",
                (float) $allocation->amount,
                $method,
                $userId,
                $userName,
            );
        }
    }

    public function refreshPaymentStatus(Purchase $purchase): Purchase
    {
        $paid = $purchase->paidAmount();
        $total = (float) ($purchase->net_amount ?? $purchase->total_price ?? 0);

        if ($paid <= 0) {
            $purchase->payment_status = PurchasePaymentStatus::NON_PAYE->value;
        } elseif ($paid >= $total) {
            $purchase->payment_status = PurchasePaymentStatus::PAYE->value;
        } else {
            $purchase->payment_status = PurchasePaymentStatus::PARTIEL->value;
        }

        $purchase->save();

        return $purchase->fresh();
    }
}
