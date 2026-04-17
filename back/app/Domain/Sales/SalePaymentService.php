<?php

namespace App\Domain\Sales;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\Transaction;
use App\Models\User;

class SalePaymentService
{
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
        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Produit',
            'method' => $validated['method'] ?? null,
            'description' => "Paiement vente #{$sale->id} - {$sale->total_quantity} X " . $this->describeSaleProduct($sale) . " POUR {$sale->client}",
            'person' => '',
            'partner' => $sale->client ?? '',
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

        return $payment->load('transaction.account');
    }

    public function deletePayment(Sale $sale, Payment $payment): void
    {
        abort_unless($payment->sale_id === $sale->id, 404);

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($sale);
    }

    public function refreshPaymentStatus(Sale $sale): void
    {
        $totalPaid = (float) $sale->payments()->sum('amount');
        $totalSale = (float) $sale->total_sale;

        if ($totalPaid <= 0) {
            $status = 'NON PAYÉ';
        } elseif ($totalPaid >= $totalSale) {
            $status = 'PAYÉ';
        } else {
            $status = 'PARTIEL';
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