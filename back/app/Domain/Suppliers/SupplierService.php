<?php

namespace App\Domain\Suppliers;

use App\Enums\PurchasePaymentStatus;
use App\Enums\PurchaseStatus;
use App\Models\Supplier;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SupplierService
{
    public function create(array $validated, $user)
    {
        return Supplier::create(array_merge(
            $validated,
            ['user_id' => $user->id]
        ));
    }

    public function update($supplier, array $validated)
    {
        $supplier->update($validated);

        return $supplier->fresh();
    }

    public function delete($supplier)
    {
        $supplier->delete();
    }

    public function getProfile(Supplier $supplier): array
    {
        $supplier->loadMissing([
            'purchases' => fn ($q) => $q->with('allocations')->latest('date')->latest('id'),
        ]);

        $purchases = $supplier->purchases->values();
        $latestPurchase = $purchases->first();

        return [
            'supplier' => $supplier,
            'purchases_count' => $purchases->count(),
            'total_purchased' => round((float) $purchases->sum('net_amount'), 2),
            'last_purchase_date' => optional($latestPurchase)->date?->toDateString(),
            'outstanding_balance' => $this->calcOutstanding($purchases),
            'purchases' => $purchases->map(fn ($p) => $this->mapPurchase($p))->values(),
        ];
    }

    public function getStatement(Supplier $supplier): array
    {
        $supplier->loadMissing([
            'purchases' => fn ($q) => $q->with('allocations.payment')->latest('date')->latest('id'),
        ]);

        $purchases = $supplier->purchases->values();
        $latestPurchase = $purchases->first();

        // One row per allocation, so a payment split across several purchases shows
        // the portion actually credited to each one rather than the full amount.
        $paymentRows = $purchases
            ->flatMap(function ($purchase) {
                return $purchase->allocations->map(fn ($allocation) => [
                    'purchase' => $purchase,
                    'allocation' => $allocation,
                ]);
            })
            ->sortBy(fn ($row) => ($row['allocation']->payment->date ?? $row['allocation']->payment->created_at)?->timestamp ?? 0)
            ->values();

        $paymentIdCounts = $paymentRows->countBy(fn ($row) => $row['allocation']->payment->id);

        $paymentRowsMapped = $paymentRows->map(function ($row) use ($paymentIdCounts) {
            $payment = $row['allocation']->payment;

            return [
                'id' => $payment->id,
                'purchase_id' => $row['purchase']->id,
                'reference' => $payment->reference,
                'date' => $payment->date?->toDateString() ?? $payment->created_at?->toDateString(),
                'amount' => round((float) $row['allocation']->amount, 2),
                'method' => $payment->method,
                'notes' => $payment->notes,
                'created_at' => $payment->created_at?->toISOString(),
                'multi' => ($paymentIdCounts[$payment->id] ?? 1) > 1,
            ];
        })->values();

        $totalPurchased = round((float) $purchases->sum('net_amount'), 2);
        $totalPaid = round((float) $paymentRowsMapped->sum('amount'), 2);

        $summary = [
            'purchases_count' => $purchases->count(),
            'payments_count' => $paymentRowsMapped->pluck('id')->unique()->count(),
            'total_purchased' => $totalPurchased,
            'total_paid' => $totalPaid,
            'outstanding_balance' => $this->calcOutstanding($purchases),
            'last_purchase_date' => optional($latestPurchase)->date?->toDateString(),
        ];

        return [
            'supplier' => $supplier,
            'summary' => $summary,
            'purchases' => $purchases->map(fn ($p) => $this->mapPurchase($p))->values(),
            'payments' => $paymentRowsMapped,
            'entries' => $this->buildEntries($purchases, $paymentRowsMapped),
        ];
    }

    /**
     * Lifetime outstanding supplier debt, one row per supplier, plus the
     * grand total (used for the `unpaid_purchases` dashboard KPI so the
     * dashboard card and the per-supplier table always agree).
     *
     * Paid-per-purchase comes from purchase_payment_allocations, never from
     * purchase_payments: a payment settling several purchases at once
     * carries purchase_id = NULL and exists only through its allocations.
     *
     * Outstanding is clamped per purchase (GREATEST(..., 0)) so an over-paid
     * purchase cannot offset another purchase's debt for the same supplier —
     * matching calcOutstanding() above and the purchase list.
     *
     * The with/without-invoice split uses complementary CASE branches so
     * total_unpaid === unpaid_with_invoice + unpaid_without_invoice always
     * holds, whatever with_invoice contains.
     *
     * @return array{rows: array<int, array<string, mixed>>, total: float}
     */
    public function unpaidBySupplier(): array
    {
        $outstanding = 'GREATEST(purchases.net_amount - COALESCE(alloc.paid, 0), 0)';

        $allocSub = DB::table('purchase_payment_allocations')
            ->selectRaw('purchase_id, SUM(amount) as paid')
            ->groupBy('purchase_id');

        $selectRaw = "purchases.supplier_id as supplier_id,
            COALESCE(suppliers.name, 'Sans fournisseur') as supplier_name,
            SUM($outstanding) as total_unpaid,
            SUM(CASE WHEN purchases.with_invoice = 1 THEN $outstanding ELSE 0 END) as unpaid_with_invoice,
            SUM(CASE WHEN purchases.with_invoice = 1 THEN 0 ELSE $outstanding END) as unpaid_without_invoice";

        $raw = DB::table('purchases')
            ->leftJoin('suppliers', 'purchases.supplier_id', '=', 'suppliers.id')
            ->leftJoinSub($allocSub, 'alloc', 'alloc.purchase_id', '=', 'purchases.id')
            ->whereNotIn('purchases.status', [PurchaseStatus::ANNULE->value])
            ->selectRaw($selectRaw)
            ->groupBy('purchases.supplier_id', 'suppliers.name')
            ->havingRaw('total_unpaid > 0')
            ->get();

        $rows = collect($raw)->map(fn ($r) => [
            'supplier_id' => $r->supplier_id !== null ? (int) $r->supplier_id : null,
            'supplier_name' => $r->supplier_name ?? 'Sans fournisseur',
            'total_unpaid' => round((float) $r->total_unpaid, 2),
            'unpaid_with_invoice' => round((float) $r->unpaid_with_invoice, 2),
            'unpaid_without_invoice' => round((float) $r->unpaid_without_invoice, 2),
        ])->sortByDesc(fn ($r) => $r['total_unpaid'])->values()->toArray();

        return [
            'rows' => $rows,
            'total' => round(array_sum(array_column($rows, 'total_unpaid')), 2),
        ];
    }

    protected function calcOutstanding(Collection $purchases): float
    {
        return round($purchases->sum(function ($purchase) {
            if (($purchase->payment_status ?? '') === PurchasePaymentStatus::PAYE->value) {
                return 0.0;
            }
            $paid = $purchase->allocations->sum('amount');

            return max((float) ($purchase->net_amount ?? 0) - (float) $paid, 0);
        }), 2);
    }

    protected function mapPurchase($purchase): array
    {
        $paid = (float) $purchase->allocations->sum('amount');
        $net = (float) ($purchase->net_amount ?? 0);

        return [
            'id' => $purchase->id,
            'supplier_id' => $purchase->supplier_id,
            'date' => $purchase->date?->toDateString(),
            'total_price' => round((float) ($purchase->total_price ?? 0), 2),
            'discount' => round((float) ($purchase->discount ?? 0), 2),
            'net_amount' => round($net, 2),
            'total_quantity' => $purchase->total_quantity ?? 0,
            'status' => $purchase->status,
            'payment_status' => $purchase->payment_status,
            'paid_amount' => round($paid, 2),
            'outstanding_amount' => round(max($net - $paid, 0), 2),
            'created_at' => $purchase->created_at?->toISOString(),
        ];
    }

    /**
     * @param  Collection  $paymentRows  plain arrays as built by getStatement() — one per allocation
     */
    protected function buildEntries(Collection $purchases, Collection $paymentRows): array
    {
        $entries = collect();

        foreach ($purchases as $purchase) {
            $entries->push([
                'type' => 'purchase',
                'date' => $purchase->date?->toDateString(),
                'description' => 'Achat #'.$purchase->id,
                'purchase_id' => $purchase->id,
                'payment_id' => null,
                'debit' => round((float) ($purchase->net_amount ?? 0), 2),
                'credit' => 0.0,
                '_sort' => ($purchase->date ?? $purchase->created_at)?->timestamp ?? 0,
            ]);
        }

        foreach ($paymentRows as $row) {
            $entries->push([
                'type' => 'payment',
                'date' => $row['date'],
                'description' => 'Paiement #'.$row['id'],
                'purchase_id' => $row['purchase_id'],
                'payment_id' => $row['id'],
                'debit' => 0.0,
                'credit' => round((float) ($row['amount'] ?? 0), 2),
                '_sort' => $row['date'] ? strtotime($row['date']) : 0,
            ]);
        }

        $running = 0.0;

        // Running balance is only meaningful computed oldest-first; the final
        // list is then reversed so the statement displays newest-first.
        return $entries
            ->sortBy('_sort')
            ->values()
            ->map(function (array $entry) use (&$running) {
                $running = round($running + $entry['debit'] - $entry['credit'], 2);
                $entry['balance'] = $running;
                unset($entry['_sort']);

                return $entry;
            })
            ->reverse()
            ->values()
            ->all();
    }
}
