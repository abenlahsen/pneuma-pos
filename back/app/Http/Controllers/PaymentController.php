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
        $payments = $sale->payments()->with('transaction')->latest('date')->get();

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
     * Also creates a Transaction (income) in Cash Flow.
     */
    public function store(Request $request, Sale $sale): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'method' => 'nullable|string|max:100',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        // Create the income Transaction in Cash Flow ONLY for cash payments
        $transaction = null;
        $method = $validated['method'] ?? '';
        if (strtolower($method) === 'espèces' || strtolower($method) === 'especes') {
            $transaction = Transaction::create([
                'date' => $validated['date'],
                'amount' => $validated['amount'],
                'type' => 'income',
                'category' => 'Produit',
                'description' => "Paiement vente #{$sale->id} - {$sale->client}",
                'person' => '',
                'partner' => $sale->client ?? '',
                'user_id' => $request->user()->id,
            ]);
        }

        // Create the Payment
        $payment = Payment::create(array_merge($validated, [
            'sale_id' => $sale->id,
            'transaction_id' => $transaction ? $transaction->id : null,
            'user_id' => $request->user()->id,
        ]));

        // Update sale payment status
        $this->updatePaymentStatus($sale);

        return response()->json($payment->load('transaction'), 201);
    }

    /**
     * Delete a payment and its linked transaction.
     */
    public function destroy(Sale $sale, Payment $payment): JsonResponse
    {
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
