<?php

namespace App\Domain\Purchases;

use App\Enums\PurchasePaymentStatus;
use App\Models\ActivityLog;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;

class PurchasePaymentService
{
    public function __construct(private ActivityLogService $activityLog) {}
    public function listForPurchase(Purchase $purchase): array
    {
        $purchase->load(['payments.transaction.account']);

        $totalPaid = (float) $purchase->payments->sum('amount');
        $totalPurchase = (float) ($purchase->net_amount ?? $purchase->total_price ?? 0);
        $remaining = max(0, $totalPurchase - $totalPaid);

        return [
            'payments' => $purchase->payments,
            'total_paid' => round($totalPaid, 2),
            'total_purchase' => round($totalPurchase, 2),
            'remaining' => round($remaining, 2),
            'payment_status' => $purchase->payment_status,
        ];
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
            'transaction_id' => $transaction->id,
            'user_id' => $user->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $validated['method'],
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
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

    public function deletePayment(Purchase $purchase, PurchasePayment $payment, ?int $userId = null, ?string $userName = null): void
    {
        if ((int) $payment->purchase_id !== (int) $purchase->id) {
            abort(404);
        }

        $amount = (float) $payment->amount;
        $method = $payment->method ?? '';

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($purchase->fresh('payments'));

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

    public function refreshPaymentStatus(Purchase $purchase): Purchase
    {
        $purchase->load('payments');

        $paid = (float) $purchase->payments->sum('amount');
        $total = (float) ($purchase->net_amount ?? $purchase->total_price ?? 0);

        if ($paid <= 0) {
            $purchase->payment_status = PurchasePaymentStatus::NON_PAYE->value;
        } elseif ($paid >= $total) {
            $purchase->payment_status = PurchasePaymentStatus::PAYE->value;
        } else {
            $purchase->payment_status = PurchasePaymentStatus::PARTIEL->value;
        }

        $purchase->save();

        return $purchase->fresh('payments');
    }
}
