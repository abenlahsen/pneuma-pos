<?php

namespace App\Domain\Purchases;

use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\Transaction;
use App\Models\User;

class PurchasePaymentService
{
    public function listForPurchase(Purchase $purchase): array
    {
        $purchase->load(['payments.transaction.account']);

        $totalPaid = (float) $purchase->payments->sum('amount');
        $totalPurchase = (float) ($purchase->total_price ?? 0);
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
            'partner' => $supplierName,
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

        return $payment->load('transaction.account');
    }

    public function deletePayment(Purchase $purchase, PurchasePayment $payment): void
    {
        if ((int) $payment->purchase_id !== (int) $purchase->id) {
            abort(404);
        }

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($purchase->fresh('payments'));
    }

    public function refreshPaymentStatus(Purchase $purchase): Purchase
    {
        $purchase->load('payments');

        $paid = (float) $purchase->payments->sum('amount');
        $total = (float) ($purchase->total_price ?? 0);

        if ($paid <= 0) {
            $purchase->payment_status = 'NON PAYE';
        } elseif ($paid >= $total) {
            $purchase->payment_status = 'PAYE';
        } else {
            $purchase->payment_status = 'PARTIEL';
        }

        $purchase->save();

        return $purchase->fresh('payments');
    }
}
