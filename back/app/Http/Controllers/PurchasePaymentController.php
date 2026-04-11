<?php

namespace App\Http\Controllers;

use App\Models\PurchasePayment;
use App\Models\Purchase;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchasePaymentController extends Controller
{
    public function index(Purchase $purchase): JsonResponse
    {
        $payments = $purchase->payments()->with('transaction.account')->latest('date')->get();
        $totalPaid = $purchase->payments()->sum('amount');

        return response()->json([
            'payments' => $payments,
            'total_paid' => round($totalPaid, 2),
            'total_purchase' => round($purchase->total_price, 2),
            'remaining' => round($purchase->total_price - $totalPaid, 2),
            'payment_status' => $purchase->payment_status,
        ]);
    }

    public function store(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'method' => 'nullable|string|max:100',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'account_id' => 'required|exists:accounts,id',
        ]);

        // Create the expense Transaction in the chosen account
        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'expense',
            'category' => 'Produit',
            'description' => "Paiement achat #{$purchase->id} - {$purchase->total_quantity} X " . $this->describePurchaseProduct($purchase),
            'person' => '',
            'partner' => $purchase->supplier->name ?? '',
            'user_id' => $request->user()->id,
            'account_id' => $validated['account_id'],
        ]);

        $payment = PurchasePayment::create(array_merge($validated, [
            'purchase_id' => $purchase->id,
            'transaction_id' => $transaction->id,
            'user_id' => $request->user()->id,
        ]));

        $this->updatePaymentStatus($purchase);

        return response()->json($payment->load('transaction.account'), 201);
    }

    public function destroy(Purchase $purchase, PurchasePayment $payment): JsonResponse
    {
        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();
        $this->updatePaymentStatus($purchase);

        return response()->json(null, 204);
    }

    /**
     * Build a human-readable description of the products in a purchase (joined for multi-item purchases).
     */
    private function describePurchaseProduct(Purchase $purchase): string
    {
        $purchase->loadMissing('items.linkedProduct.brand', 'items.linkedProduct.tyre');

        $parts = $purchase->items->map(function ($item) {
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

    private function updatePaymentStatus(Purchase $purchase): void
    {
        $totalPaid = $purchase->payments()->sum('amount');
        $totalPurchase = (float) $purchase->total_price;

        if ($totalPaid <= 0) {
            $status = 'NON PAYE';
        } elseif ($totalPaid >= $totalPurchase) {
            $status = 'PAYE';
        } else {
            $status = 'PARTIEL';
        }

        $purchase->update(['payment_status' => $status]);
    }
}
