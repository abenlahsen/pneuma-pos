<?php

namespace App\Domain\ServiceOrders;

use App\Models\ServiceOrder;
use App\Models\ServicePayment;
use App\Models\Transaction;
use App\Models\User;

class ServicePaymentService
{
    public function listForOrder(ServiceOrder $order): array
    {
        $payments = $order->payments()->with('transaction.account')->latest('date')->get();
        $totalPaid = (float) $order->payments()->sum('amount');
        $netAmount = (float) $order->net_amount;

        return [
            'payments' => $payments,
            'total_paid' => round($totalPaid, 2),
            'total_amount' => round($netAmount, 2),
            'remaining' => round($netAmount - $totalPaid, 2),
            'payment_status' => $order->payment_status,
        ];
    }

    public function createPayment(ServiceOrder $order, array $validated, User $user): ServicePayment
    {
        $transactionId = null;

        if (($validated['method'] ?? '') === 'Espèces') {
            $transaction = Transaction::create([
                'date' => $validated['date'],
                'amount' => $validated['amount'],
                'type' => 'income',
                'category' => 'Produit',
                'method' => 'Espèces',
                'description' => "Paiement service #{$order->id} - " . $this->describeOrderItems($order) . " POUR {$order->client}",
                'person' => '',
                'partner' => $order->client,
                'user_id' => $user->id,
                'account_id' => $validated['account_id'] ?? null,
            ]);

            $transactionId = $transaction->id;
        }

        $payment = ServicePayment::create([
            'service_order_id' => $order->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $validated['method'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'transaction_id' => $transactionId,
            'user_id' => $user->id,
        ]);

        $this->refreshPaymentStatus($order);

        return $payment->load('transaction.account');
    }

    public function deletePayment(ServiceOrder $order, ServicePayment $payment): void
    {
        abort_unless($payment->service_order_id === $order->id, 404);

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($order);
    }

    private function describeOrderItems(ServiceOrder $order): string
    {
        $order->loadMissing('items');
        $types = $order->items->pluck('service_type')->filter()->unique()->implode(', ');

        return $types ?: 'Service';
    }

    public function refreshPaymentStatus(ServiceOrder $order): void
    {
        $totalPaid = (float) $order->payments()->sum('amount');
        $netAmount = (float) $order->net_amount;

        if ($totalPaid <= 0) {
            $status = 'NON PAYE';
        } elseif ($totalPaid >= $netAmount) {
            $status = 'PAYE';
        } else {
            $status = 'PARTIEL';
        }

        $order->update(['payment_status' => $status]);
    }
}
