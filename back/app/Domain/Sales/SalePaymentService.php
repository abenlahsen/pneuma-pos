<?php

namespace App\Domain\Sales;

use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalePaymentService
{
    public function __construct(private ActivityLogService $activityLog) {}

    public function listForSale(Sale $sale): array
    {
        $rows = $this->buildPaymentRowsForSale($sale);

        $totalPaid = (float) $rows->sum('amount');
        $totalSale = (float) $sale->total_sale;

        return [
            'payments' => $rows,
            'total_paid' => round($totalPaid, 2),
            'total_sale' => round($totalSale, 2),
            'remaining' => round($totalSale - $totalPaid, 2),
            'payment_status' => $sale->payment_status,
        ];
    }

    /**
     * Build the payment rows to display for a single sale, one row per
     * allocation. Each row is shaped like the legacy Payment resource
     * (id = parent payment id, amount = the portion allocated to this sale)
     * so the existing frontend keeps working unchanged. A `multi` flag marks
     * rows whose parent payment also covers other sales.
     */
    public function buildPaymentRowsForSale(Sale $sale)
    {
        $allocations = $sale->allocations()
            ->with(['payment' => function ($q) {
                $q->withCount('allocations')->with('transaction.account');
            }])
            ->get();

        return $allocations->map(function (SalePaymentAllocation $allocation) use ($sale) {
            $payment = $allocation->payment;

            return (object) [
                'id' => $payment->id,
                'allocation_id' => $allocation->id,
                'sale_id' => $sale->id,
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

    public function createPayment(Sale $sale, array $validated, User $user): Payment
    {
        $sale->loadMissing('linkedClient');

        $clientName = $sale->linkedClient?->name ?? $sale->client ?? '';

        $transaction = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Vente marchandise',
            'method' => $validated['method'] ?? null,
            'description' => "Paiement vente #{$sale->id} - {$sale->total_quantity} X ".$this->describeSaleProduct($sale)." POUR {$clientName}",
            'person' => '',
            'user_id' => $user->id,
            'account_id' => $validated['account_id'],
        ]);

        $payment = Payment::create([
            'sale_id' => $sale->id,
            'client_id' => $sale->client_id,
            'transaction_id' => $transaction->id,
            'amount' => $validated['amount'],
            'date' => $validated['date'],
            'method' => $validated['method'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'user_id' => $user->id,
        ]);

        SalePaymentAllocation::create([
            'payment_id' => $payment->id,
            'sale_id' => $sale->id,
            'amount' => $validated['amount'],
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

    /**
     * Create a single payment split across several sales belonging to the
     * same client ("Régler des ventes" flow on the client profile page).
     *
     * @param  array<string, mixed>  $validated  amount, method, date, account_id, reference?, notes?,
     *                                           allocations: array<{sale_id: int, amount: float}>
     */
    public function createClientPayment(Client $client, array $validated, User $user): Payment
    {
        $allocationsInput = collect($validated['allocations'] ?? [])
            ->filter(fn ($row) => (float) ($row['amount'] ?? 0) > 0)
            ->values();

        if ($allocationsInput->isEmpty()) {
            throw ValidationException::withMessages([
                'allocations' => ['Veuillez répartir le montant sur au moins une vente.'],
            ]);
        }

        $saleIds = $allocationsInput->pluck('sale_id')->all();
        $sales = Sale::whereIn('id', $saleIds)->get()->keyBy('id');

        $sumAllocated = round((float) $allocationsInput->sum('amount'), 2);
        $amount = round((float) $validated['amount'], 2);

        if (abs($sumAllocated - $amount) > 0.01) {
            throw ValidationException::withMessages([
                'amount' => ["La répartition ({$sumAllocated} DH) ne correspond pas au montant du paiement ({$amount} DH)."],
            ]);
        }

        foreach ($allocationsInput as $row) {
            $sale = $sales->get($row['sale_id']);

            if (! $sale || (int) $sale->client_id !== (int) $client->id) {
                throw ValidationException::withMessages([
                    'allocations' => ["La vente #{$row['sale_id']} n'appartient pas à ce client."],
                ]);
            }

            $remaining = round((float) $sale->total_sale - $sale->paid_amount, 2);
            if (round((float) $row['amount'], 2) - $remaining > 0.01) {
                throw ValidationException::withMessages([
                    'allocations' => ["Le montant affecté à la vente #{$sale->id} dépasse son solde restant ({$remaining} DH)."],
                ]);
            }
        }

        return DB::transaction(function () use ($validated, $allocationsInput, $sales, $client, $user, $amount) {
            $transaction = Transaction::create([
                'date' => $validated['date'],
                'amount' => $amount,
                'type' => 'income',
                'category' => 'Vente marchandise',
                'method' => $validated['method'] ?? null,
                'description' => "Règlement client {$client->name} — {$allocationsInput->count()} vente(s)",
                'person' => '',
                'user_id' => $user->id,
                'account_id' => $validated['account_id'],
            ]);

            $payment = Payment::create([
                'sale_id' => null,
                'client_id' => $client->id,
                'transaction_id' => $transaction->id,
                'amount' => $amount,
                'date' => $validated['date'],
                'method' => $validated['method'] ?? null,
                'reference' => $validated['reference'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'user_id' => $user->id,
            ]);

            foreach ($allocationsInput as $row) {
                SalePaymentAllocation::create([
                    'payment_id' => $payment->id,
                    'sale_id' => $row['sale_id'],
                    'amount' => round((float) $row['amount'], 2),
                ]);

                $sale = $sales->get($row['sale_id']);
                $this->refreshPaymentStatus($sale);

                $this->activityLog->logPaymentAdded(
                    ActivityLog::ENTITY_VENTE,
                    $sale->id,
                    "Vente #{$sale->id}",
                    round((float) $row['amount'], 2),
                    $validated['method'] ?? 'Espèces',
                    $validated['reference'] ?? null,
                    $user->id,
                    $user->name,
                );
            }

            return $payment->load(['transaction.account', 'allocations.sale']);
        });
    }

    /**
     * Sales still owing money for a client, oldest first — used to feed
     * the "Régler des ventes" allocation UI.
     */
    public function unpaidSalesForClient(Client $client)
    {
        return $client->sales()
            ->where('status', '!=', SaleStatus::ANNULE->value)
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'date' => $sale->date?->toDateString(),
                'total_sale' => round((float) ($sale->total_sale ?? 0), 2),
                'paid_amount' => round($sale->paid_amount, 2),
                'remaining' => round(max(0, (float) ($sale->total_sale ?? 0) - $sale->paid_amount), 2),
                'with_invoice' => (bool) $sale->with_invoice,
            ])
            ->filter(fn ($row) => $row['remaining'] > 0.01)
            ->values();
    }

    public function deletePayment(Sale $sale, Payment $payment, ?int $userId = null, ?string $userName = null): void
    {
        $allocation = SalePaymentAllocation::where('payment_id', $payment->id)
            ->where('sale_id', $sale->id)
            ->first();

        if (! $allocation) {
            abort(404);
        }

        $totalAllocations = SalePaymentAllocation::where('payment_id', $payment->id)->count();

        if ($totalAllocations > 1) {
            abort(422, 'Ce paiement couvre plusieurs ventes. Supprimez-le depuis la fiche du client.');
        }

        $amount = (float) $payment->amount;
        $method = $payment->method ?? '';

        if ($payment->transaction_id) {
            Transaction::where('id', $payment->transaction_id)->delete();
        }

        $payment->delete();

        $this->refreshPaymentStatus($sale->fresh());

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

    /**
     * Fully delete a (possibly multi-sale) payment: removes the transaction,
     * the payment, all its allocations, and refreshes every affected sale.
     * Used from the client profile page.
     */
    public function deleteClientPayment(Client $client, Payment $payment, ?int $userId = null, ?string $userName = null): void
    {
        if ((int) $payment->client_id !== (int) $client->id) {
            abort(404);
        }

        $this->deletePaymentAndRefresh($payment, $userId, $userName);
    }

    /**
     * Fully delete a payment (single or multi-sale): removes the transaction,
     * the payment, all its allocations (cascade), and recomputes payment_status
     * on every sale it covered — even ones that were already fully paid. Used
     * both by the client-profile deletion flow and by the Cash Flow module
     * when deleting a transaction that happens to be linked to a payment.
     */
    public function deletePaymentAndRefresh(Payment $payment, ?int $userId = null, ?string $userName = null): void
    {
        $method = $payment->method ?? '';
        $allocations = $payment->allocations()->get(['sale_id', 'amount']);
        $affectedSales = Sale::whereIn('id', $allocations->pluck('sale_id'))->get()->keyBy('id');

        DB::transaction(function () use ($payment) {
            if ($payment->transaction_id) {
                Transaction::where('id', $payment->transaction_id)->delete();
            }

            $payment->delete();
        });

        foreach ($allocations as $allocation) {
            $sale = $affectedSales->get($allocation->sale_id);
            if (! $sale) {
                continue;
            }

            $this->refreshPaymentStatus($sale->fresh());

            $this->activityLog->logPaymentDeleted(
                ActivityLog::ENTITY_VENTE,
                $sale->id,
                "Vente #{$sale->id}",
                (float) $allocation->amount,
                $method,
                $userId,
                $userName,
            );
        }
    }

    /**
     * Full breakdown of a payment: its own info plus every sale it covers
     * (one entry per allocation, single or multi-sale). Used by the
     * "view payment" modal to link back to each sale.
     */
    public function getPaymentDetail(Payment $payment): array
    {
        $payment->load(['client', 'transaction.account', 'allocations.sale']);

        return [
            'id' => $payment->id,
            'date' => $payment->date,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'created_at' => $payment->created_at,
            'client' => $payment->client ? [
                'id' => $payment->client->id,
                'name' => $payment->client->name,
            ] : null,
            'account' => $payment->transaction?->account ? [
                'id' => $payment->transaction->account->id,
                'name' => $payment->transaction->account->name,
            ] : null,
            'sales' => $payment->allocations->map(fn (SalePaymentAllocation $allocation) => [
                'id' => $allocation->sale->id,
                'date' => $allocation->sale->date?->toDateString(),
                'total_sale' => (float) ($allocation->sale->total_sale ?? 0),
                'status' => $allocation->sale->status,
                'payment_status' => $allocation->sale->payment_status,
                'allocated_amount' => (float) $allocation->amount,
            ])->values(),
        ];
    }

    public function refreshPaymentStatus(Sale $sale): void
    {
        $totalPaid = $sale->paid_amount;
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
            if (! $product) {
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
