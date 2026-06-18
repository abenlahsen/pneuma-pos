<?php

namespace App\Domain\Sales;

use App\Enums\SalePaymentStatus;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;

class SalePaymentService
{
    public function __construct(private ActivityLogService $activityLog) {}
    public function listForSale(Sale $sale): array
    {
        $payments = $sale->payments()->with('transaction.account')->latest('date')->get();
        $totalPaid = (float) $sale->payments()->sum('amount');
        $totalSale = (float) $sale->total_sale;

        return [
            'payments' => $payments,
            'total_paid' => round($totalPaid, 2),
            'total_sale' => round($totalSale, 2),
            'remaining' => round($totalSale - $totalPaid, 2),
            'payment_status' => $sale->payment_status,
        ];
    }

    public function createPayment(Sale $sale, array $validated, User $user): Payment
    {
        $sale->loadMissing('linkedClient');

        $clientName = $sale->linkedClient?->name ?? $sale->client ?? '';

        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Produit',
            'method' => $validated['method'] ?? null,
            'description' => "Paiement vente #{$sale->id} - {$sale->total_quantity} X " . $this->describeSaleProduct($sale) . " POUR {$clientName}",
            'person' => '',
            'user_id' => $user->id,
            'account_id' => $validated['account_id'],
        ]);

        $payment = Payment::create([
            'sale_id' => $sale->id,
            'transaction_id' => $transaction->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $validated['method'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'user_id' => $user->id,
        ]);

        $this->refreshPaymentStatus($sale);

        $this->activityLog->logPaymentAdded(
            ActivityLog::ENTITY_VENTE,
            $sale->id,
            "Vente #{$sale->id}",
            (float) $validated['amount'],
            $validated['method'] ?? 'Espèces',
            $validated['reference'] ?? null,
            $user->id,
            $user->name,
        );

        return $payment->load('transaction.account');
    }

    public function deletePayment(Sale $sale, Payment $payment, ?int $userId = null, ?string $userName = null): void
    {
        abort_unless($payment->sale_id === $sale->id, 404);

        $amount = (float) $payment->amount;
        $method = $payment->method ?? '';

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($sale);

        $this->activityLog->logPaymentDeleted(
            ActivityLog::ENTITY_VENTE,
            $sale->id,
            "Vente #{$sale->id}",
            $amount,
            $method,
            $userId,
            $userName,
        );
    }

    public function refreshPaymentStatus(Sale $sale): void
    {
        $totalPaid = (float) $sale->payments()->sum('amount');
        $totalSale = (float) $sale->total_sale;

        if ($totalPaid <= 0) {
            $status = SalePaymentStatus::NON_PAYE->value;
        } elseif ($totalPaid >= $totalSale) {
            $status = SalePaymentStatus::PAYE->value;
        } else {
            $status = SalePaymentStatus::PARTIEL->value;
        }

        $sale->update(['payment_status' => $status]);
    }

    private function describeSaleProduct(Sale $sale): string
    {
        $sale->loadMissing('items.linkedProduct.brand', 'items.linkedProduct.tyre');

        $parts = $sale->items->map(function ($item) {
            $product = $item->linkedProduct;
            if (!$product) {
                return null;
            }

            $brand = $product->brand ? $product->brand->name : '';
            $tyre = $product->tyre;
            $dimension = $tyre && $tyre->tire_width
                ? "{$tyre->tire_width}/{$tyre->tire_height}R{$tyre->tire_diameter}"
                : '';
            $profile = isset($product->profile) ? $product->profile : '';

            return trim(implode(' ', array_filter([$brand, $profile, $dimension])));
        })->filter()->values();

        return $parts->implode(' + ');
    }
}
