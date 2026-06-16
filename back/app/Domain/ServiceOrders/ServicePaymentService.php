<?php

namespace App\Domain\ServiceOrders;

use App\Models\ActivityLog;
use App\Models\ServiceOrder;
use App\Models\ServicePayment;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;

class ServicePaymentService
{
    public function __construct(private ActivityLogService $activityLog) {}
    public function listForOrder(ServiceOrder $order): array
    {
        $payments = $order->payments()->with('transaction.account', 'account')->latest('date')->get();
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
        $accountId = $validated['account_id'] ?? null;
        $method = $validated['method'] ?? null;

        if ($accountId || $method === 'Espèces') {
            $transaction = Transaction::create([
                'date' => $validated['date'],
                'amount' => $validated['amount'],
                'type' => 'income',
                'category' => 'Produit',
                'method' => $method ?? 'Espèces',
                'description' => "Paiement service #{$order->id} - " . $this->describeOrderItems($order) . " POUR {$order->client}",
                'person' => '',
                'partner' => $order->client,
                'user_id' => $user->id,
                'account_id' => $accountId,
            ]);

            $transactionId = $transaction->id;
        }

        $payment = ServicePayment::create([
            'service_order_id' => $order->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $method,
            'account_id' => $accountId,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'transaction_id' => $transactionId,
            'user_id' => $user->id,
        ]);

        $this->refreshPaymentStatus($order);

        $this->activityLog->logPaymentAdded(
            ActivityLog::ENTITY_SERVICE_ORDER,
            $order->id,
            "Ordre de service #{$order->id}",
            (float) $validated['amount'],
            $method ?? 'Espèces',
            $validated['reference'] ?? null,
            $user->id,
            $user->name,
        );

        return $payment->load('transaction.account', 'account');
    }

    public function deletePayment(ServiceOrder $order, ServicePayment $payment, ?int $userId = null, ?string $userName = null): void
    {
        abort_unless($payment->service_order_id === $order->id, 404);

        $amount = (float) $payment->amount;
        $method = $payment->method ?? '';

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($order);

        $this->activityLog->logPaymentDeleted(
            ActivityLog::ENTITY_SERVICE_ORDER,
            $order->id,
            "Ordre de service #{$order->id}",
            $amount,
            $method,
            $userId,
            $userName,
        );
    }

    private function describeOrderItems(ServiceOrder $order): string
    {
        $order->loadMissing('items.product');
        $types = $order->items->pluck('product.profile')->filter()->unique()->implode(', ');

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
