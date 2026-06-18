<?php

namespace App\Domain\Suppliers;

use App\Enums\PurchasePaymentStatus;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Collection;

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
            'purchases' => fn ($q) => $q->with('payments')->latest('date')->latest('id'),
        ]);

        $purchases = $supplier->purchases->values();
        $latestPurchase = $purchases->first();

        return [
            'supplier'          => $supplier,
            'purchases_count'   => $purchases->count(),
            'total_purchased'   => round((float) $purchases->sum('net_amount'), 2),
            'last_purchase_date' => optional($latestPurchase)->date?->toDateString(),
            'outstanding_balance' => $this->calcOutstanding($purchases),
            'purchases'         => $purchases->map(fn ($p) => $this->mapPurchase($p))->values(),
        ];
    }

    public function getStatement(Supplier $supplier): array
    {
        $supplier->loadMissing([
            'purchases' => fn ($q) => $q->with('payments')->latest('date')->latest('id'),
        ]);

        $purchases = $supplier->purchases->values();
        $latestPurchase = $purchases->first();

        $payments = $purchases
            ->flatMap(fn ($p) => $p->payments ?? collect())
            ->sortBy(fn ($pay) => ($pay->date ?? $pay->created_at)?->timestamp ?? 0)
            ->values();

        $paymentRows = $payments->map(fn ($pay) => [
            'id'          => $pay->id,
            'purchase_id' => $pay->purchase_id,
            'reference'   => $pay->reference,
            'date'        => $pay->date?->toDateString() ?? $pay->created_at?->toDateString(),
            'amount'      => round((float) ($pay->amount ?? 0), 2),
            'method'      => $pay->method,
            'notes'       => $pay->notes,
            'created_at'  => $pay->created_at?->toISOString(),
        ])->values();

        $totalPurchased = round((float) $purchases->sum('net_amount'), 2);
        $totalPaid      = round((float) $paymentRows->sum('amount'), 2);

        $summary = [
            'purchases_count'    => $purchases->count(),
            'payments_count'     => $payments->count(),
            'total_purchased'    => $totalPurchased,
            'total_paid'         => $totalPaid,
            'outstanding_balance' => $this->calcOutstanding($purchases),
            'last_purchase_date' => optional($latestPurchase)->date?->toDateString(),
        ];

        return [
            'supplier' => $supplier,
            'summary'  => $summary,
            'purchases' => $purchases->map(fn ($p) => $this->mapPurchase($p))->values(),
            'payments'  => $paymentRows,
            'entries'   => $this->buildEntries($purchases, $payments),
        ];
    }

    protected function calcOutstanding(Collection $purchases): float
    {
        return round($purchases->sum(function ($purchase) {
            if (($purchase->payment_status ?? '') === PurchasePaymentStatus::PAYE->value) {
                return 0.0;
            }
            $paid = $purchase->payments->sum('amount');
            return max((float) ($purchase->net_amount ?? 0) - (float) $paid, 0);
        }), 2);
    }

    protected function mapPurchase($purchase): array
    {
        $paid = (float) $purchase->payments->sum('amount');
        $net  = (float) ($purchase->net_amount ?? 0);

        return [
            'id'               => $purchase->id,
            'supplier_id'      => $purchase->supplier_id,
            'date'             => $purchase->date?->toDateString(),
            'total_price'      => round((float) ($purchase->total_price ?? 0), 2),
            'discount'         => round((float) ($purchase->discount ?? 0), 2),
            'net_amount'       => round($net, 2),
            'total_quantity'   => $purchase->total_quantity ?? 0,
            'status'           => $purchase->status,
            'payment_status'   => $purchase->payment_status,
            'payment_method'   => $purchase->payment_method,
            'paid_amount'      => round($paid, 2),
            'outstanding_amount' => round(max($net - $paid, 0), 2),
            'created_at'       => $purchase->created_at?->toISOString(),
        ];
    }

    protected function buildEntries(Collection $purchases, Collection $payments): array
    {
        $entries = collect();

        foreach ($purchases as $purchase) {
            $entries->push([
                'type'        => 'purchase',
                'date'        => $purchase->date?->toDateString(),
                'description' => 'Achat #' . $purchase->id,
                'purchase_id' => $purchase->id,
                'payment_id'  => null,
                'debit'       => round((float) ($purchase->net_amount ?? 0), 2),
                'credit'      => 0.0,
                '_sort'       => ($purchase->date ?? $purchase->created_at)?->timestamp ?? 0,
            ]);
        }

        foreach ($payments as $payment) {
            $entries->push([
                'type'        => 'payment',
                'date'        => $payment->date?->toDateString() ?? $payment->created_at?->toDateString(),
                'description' => 'Paiement #' . $payment->id,
                'purchase_id' => $payment->purchase_id,
                'payment_id'  => $payment->id,
                'debit'       => 0.0,
                'credit'      => round((float) ($payment->amount ?? 0), 2),
                '_sort'       => ($payment->date ?? $payment->created_at)?->timestamp ?? 0,
            ]);
        }

        $running = 0.0;

        return $entries
            ->sortBy('_sort')
            ->values()
            ->map(function (array $entry) use (&$running) {
                $running = round($running + $entry['debit'] - $entry['credit'], 2);
                $entry['balance'] = $running;
                unset($entry['_sort']);
                return $entry;
            })
            ->all();
    }
}
