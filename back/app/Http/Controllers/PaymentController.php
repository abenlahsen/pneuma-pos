<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    /**
     * List all payments for a sale.
     */
    public function index(Sale $sale): JsonResponse
    {
        $payments = $sale->payments()->with('transaction.account')->latest('date')->get();

        $totalPaid = $sale->payments()->sum('amount');

        return response()->json([
            'payments' => $payments,
            'total_paid' => round($totalPaid, 2),
            'total_sale' => round($sale->total_sale, 2),
            'remaining' => round($sale->total_sale - $totalPaid, 2),
            'payment_status' => $sale->payment_status,
        ]);
    }

    /**
     * Store a new payment for a sale.
     * Always creates a Transaction (income) in the chosen account.
     */
    public function store(Request $request, Sale $sale): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'method' => 'nullable|string|max:100',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'account_id' => 'required|exists:accounts,id',
        ]);

        // Create the income Transaction in the chosen account
        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Produit',
            'description' => "Paiement vente #{$sale->id} - {$sale->total_quantity} X " . $this->describeSaleProduct($sale) . " POUR {$sale->client}",
            'person' => '',
            'partner' => $sale->client ?? '',
            'user_id' => $request->user()->id,
            'account_id' => $validated['account_id'],
        ]);

        // Create the Payment
        $payment = Payment::create(array_merge($validated, [
            'sale_id' => $sale->id,
            'transaction_id' => $transaction->id,
            'user_id' => $request->user()->id,
        ]));

        // Update sale payment status
        $this->updatePaymentStatus($sale);

        return response()->json($payment->load('transaction.account'), 201);
    }

    /**
     * Delete a payment and its linked transaction.
     */
    public function destroy(Sale $sale, Payment $payment): JsonResponse
    {
        // IDOR guard: the payment must belong to the sale in the URL.
        abort_unless($payment->sale_id === $sale->id, 404);

        // Delete linked transaction if exists
        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        // Recalculate status
        $this->updatePaymentStatus($sale);

        return response()->json(null, 204);
    }

    /**
     * Build a human-readable description of the products in a sale (joined for multi-item sales).
     */
    private function describeSaleProduct(Sale $sale): string
    {
        $sale->loadMissing('items.linkedProduct.brand', 'items.linkedProduct.tyre');

        $parts = $sale->items->map(function ($item) {
            $product = $item->linkedProduct;
            if (!$product) {
                return null;
            }
            $brand = $product->brand?->name ?? '';
            $tyre = $product->tyre;
            $dimension = $tyre && $tyre->tire_width
                ? "{$tyre->tire_width}/{$tyre->tire_height}R{$tyre->tire_diameter}"
                : '';
            $profile = $product->profile ?? '';

            return trim(implode(' ', array_filter([$brand, $profile, $dimension])));
        })->filter()->values();

        return $parts->implode(' + ');
    }

    /**
     * Update the payment_status on the sale based on sum of payments.
     */
    private function updatePaymentStatus(Sale $sale): void
    {
        $totalPaid = $sale->payments()->sum('amount');
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
}
