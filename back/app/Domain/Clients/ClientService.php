<?php

namespace App\Domain\Clients;

use App\Models\City;
use App\Models\Client;
use App\Models\Sale;
use App\Models\ServiceOrder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ClientService
{
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 15);
        $perPage = $perPage > 0 ? min($perPage, 100) : 15;

        return $this->buildQuery($filters)
            ->with('cityRelation')
            ->paginate($perPage)
            ->appends($filters);
    }

    public function create(array $data): Client
    {
        return Client::create($data);
    }

    public function update(Client $client, array $data): Client
    {
        $client->update($data);

        return $client->refresh();
    }

    public function delete(Client $client): void
    {
        $client->delete();
    }

    public function buildFilteredQuery(array $filters): Builder
    {
        return $this->buildQuery($filters)->with('cityRelation');
    }

    public function findDuplicates(?string $name = null, ?string $phone = null, ?int $exceptId = null): Collection
    {
        $name = $this->cleanString($name);
        $phone = $this->cleanString($phone);

        if ($name === null && $phone === null) {
            return collect();
        }

        return Client::query()
            ->when($exceptId, fn (Builder $query) => $query->whereKeyNot($exceptId))
            ->where(function (Builder $query) use ($name, $phone) {
                if ($phone !== null) {
                    $query->where('phone', 'like', '%'.$phone.'%');
                }

                if ($name !== null) {
                    $method = $phone !== null ? 'orWhere' : 'where';
                    $query->{$method}('name', 'like', '%'.$name.'%');
                }
            })
            ->orderBy('name')
            ->limit(10)
            ->get();
    }

    public function getProfile(Client $client): array
    {
        $client->loadMissing([
            'sales' => fn ($query) => $query->with(['linkedClient', 'allocations'])->latest('date')->latest('id'),
            'serviceOrders' => fn ($query) => $query->with(['payments'])->latest('date')->latest('id'),
        ]);

        $sales = $client->sales->values();
        $serviceOrders = $client->serviceOrders->values();

        $allDates = $sales->map(fn ($s) => $s->sale_date ?? $s->created_at)
            ->merge($serviceOrders->map(fn ($o) => $o->date ?? $o->created_at))
            ->filter()
            ->sortByDesc(fn ($d) => $d->timestamp ?? 0);
        $lastDate = $allDates->first();

        $salesHistory = $sales->map(fn (Sale $sale) => $this->mapSale($sale));
        $serviceHistory = $serviceOrders->map(fn (ServiceOrder $order) => $this->mapServiceOrder($order));
        $allHistory = $salesHistory->merge($serviceHistory)
            ->sortByDesc(fn ($row) => $row['sale_date'] ?? $row['created_at'] ?? null)
            ->values();

        $totalSales = $sales->sum(fn (Sale $s) => (float) ($s->total ?? 0));
        $totalOrders = $serviceOrders->sum(fn (ServiceOrder $o) => (float) ($o->net_amount ?? 0));

        return [
            'client' => $client,
            'sales_count' => $sales->count() + $serviceOrders->count(),
            'total_purchased' => round($totalSales + $totalOrders, 2),
            'last_sale_date' => optional($lastDate)->toDateString(),
            'outstanding_balance' => $this->calculateOutstandingBalanceAll($client, $sales, $serviceOrders),
            'sales' => $allHistory,
            'sales_history' => $allHistory,
        ];
    }

    public function getStatement(Client $client): array
    {
        $client->loadMissing([
            'sales' => fn ($query) => $query->with(['allocations.payment', 'linkedClient'])->latest('date')->latest('id'),
            'serviceOrders' => fn ($query) => $query->with(['payments'])->latest('date')->latest('id'),
        ]);

        $sales = $client->sales->values();
        $serviceOrders = $client->serviceOrders->values();

        $allDates = $sales->map(fn ($s) => $s->sale_date ?? $s->created_at)
            ->merge($serviceOrders->map(fn ($o) => $o->date ?? $o->created_at))
            ->filter()
            ->sortByDesc(fn ($d) => $d->timestamp ?? 0);
        $lastDate = $allDates->first();

        $salesRows = $sales->map(fn (Sale $sale) => $this->mapSale($sale));
        $serviceRows = $serviceOrders->map(fn (ServiceOrder $order) => $this->mapServiceOrder($order));
        $allRows = $salesRows->merge($serviceRows)
            ->sortByDesc(fn ($row) => $row['sale_date'] ?? $row['created_at'] ?? null)
            ->values();

        // One row per allocation, so a payment split across several sales shows
        // the portion actually credited to each one rather than the full amount.
        $saleAllocationRows = $sales
            ->flatMap(function (Sale $sale) {
                return $sale->allocations->map(fn ($allocation) => [
                    'sale' => $sale,
                    'allocation' => $allocation,
                ]);
            })
            ->sortBy(fn ($row) => ($row['allocation']->payment->payment_date ?? $row['allocation']->payment->paid_at ?? $row['allocation']->payment->created_at)?->timestamp ?? 0)
            ->values();

        $servicePayments = $serviceOrders
            ->flatMap(fn (ServiceOrder $order) => $order->payments ?? collect())
            ->sortBy(fn ($p) => $p->date?->timestamp ?? $p->created_at?->timestamp ?? 0)
            ->values();

        $paymentIdCounts = $saleAllocationRows->countBy(fn ($row) => $row['allocation']->payment->id);

        $salePaymentRows = $saleAllocationRows->map(function ($row) use ($paymentIdCounts) {
            $payment = $row['allocation']->payment;

            return [
                'id' => $payment->id,
                'sale_id' => $row['sale']->id,
                'date' => $this->formatDate($payment->payment_date ?? $payment->paid_at ?? $payment->created_at),
                'amount' => round((float) $row['allocation']->amount, 2),
                'payment_method' => $payment->method ?? null,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'created_at' => $this->formatDateTime($payment->created_at),
                'updated_at' => $this->formatDateTime($payment->updated_at),
                'multi' => ($paymentIdCounts[$payment->id] ?? 1) > 1,
            ];
        })->values();

        $servicePaymentRows = $servicePayments->map(fn ($payment) => [
            'id' => 'sp_'.$payment->id,
            'sale_id' => null,
            'service_order_id' => $payment->service_order_id,
            'date' => $this->formatDate($payment->date ?? $payment->created_at),
            'amount' => round((float) ($payment->amount ?? 0), 2),
            'payment_method' => $payment->method ?? null,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'created_at' => $this->formatDateTime($payment->created_at),
            'updated_at' => $this->formatDateTime($payment->updated_at),
        ])->values();

        $allPaymentRows = $salePaymentRows->merge($servicePaymentRows)
            ->sortBy(fn ($row) => $row['date'] ?? null)
            ->values();

        $totalSales = $sales->sum(fn (Sale $s) => (float) ($s->total ?? 0));
        $totalOrders = $serviceOrders->sum(fn (ServiceOrder $o) => (float) ($o->net_amount ?? 0));
        $totalPaidSales = (float) $salePaymentRows->sum('amount');
        $totalPaidOrders = (float) $servicePayments->sum('amount');

        $summary = [
            'sales_count' => $sales->count() + $serviceOrders->count(),
            'payments_count' => $salePaymentRows->pluck('id')->unique()->count() + $servicePayments->count(),
            'opening_balance' => round((float) ($client->opening_balance ?? 0), 2),
            'total_sales' => round($totalSales + $totalOrders, 2),
            'total_paid' => round($totalPaidSales + $totalPaidOrders, 2),
            'outstanding_balance' => $this->calculateOutstandingBalanceAll($client, $sales, $serviceOrders),
            'last_sale_date' => $this->formatDate($lastDate),
        ];

        return [
            'client' => $client,
            'summary' => $summary,
            'sales' => $allRows->all(),
            'payments' => $allPaymentRows->all(),
            'entries' => $this->buildAllEntries($client, $sales, $salePaymentRows, $serviceOrders, $servicePayments),
        ];
    }

    protected function buildQuery(array $filters): Builder
    {
        $query = Client::query()->latest('id');

        $search = $this->cleanString($filters['search'] ?? $filters['q'] ?? null);
        $name = $this->cleanString($filters['name'] ?? null);
        $phone = $this->cleanString($filters['phone'] ?? null);
        $city = $this->cleanString($filters['city'] ?? null);
        $category = $this->cleanString($filters['category'] ?? $filters['type'] ?? null);

        if ($search !== null) {
            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhereHas('cityRelation', fn (Builder $q) => $q->where('name', 'like', '%'.$search.'%'));
            });
        }

        if ($name !== null) {
            $query->where('name', 'like', '%'.$name.'%');
        }

        if ($phone !== null) {
            $query->where('phone', 'like', '%'.$phone.'%');
        }

        if ($city !== null) {
            $cityId = City::where('name', $city)->value('id');
            if ($cityId) {
                $query->where('city_id', $cityId);
            }
        }

        if ($category !== null) {
            $query->where('category', $category);
        }

        $activeFilter = $this->normalizeActiveFilter($filters);

        if ($activeFilter !== null) {
            $query->where('is_active', $activeFilter);
        }

        return $query;
    }

    protected function normalizeActiveFilter(array $filters): ?bool
    {
        foreach (['is_active', 'active'] as $key) {
            if (! array_key_exists($key, $filters) || $filters[$key] === '' || $filters[$key] === null) {
                continue;
            }

            return $this->toBoolean($filters[$key]);
        }

        if (($filters['inactive'] ?? null) !== null && $filters['inactive'] !== '') {
            $inactive = $this->toBoolean($filters['inactive']);

            return $inactive === null ? null : ! $inactive;
        }

        return null;
    }

    protected function toBoolean(mixed $value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }

        $normalized = Str::lower(trim((string) $value));

        return match ($normalized) {
            '1', 'true', 'yes', 'on', 'active' => true,
            '0', 'false', 'no', 'off', 'inactive' => false,
            default => null,
        };
    }

    protected function calculateOutstandingBalance(Client $client, Collection $sales): float
    {
        return $this->calculateOutstandingBalanceAll($client, $sales, collect());
    }

    protected function calculateOutstandingBalanceAll(Client $client, Collection $sales, Collection $serviceOrders): float
    {
        $openingBalance = (float) ($client->opening_balance ?? 0);
        $salesOutstanding = $sales->sum(fn (Sale $sale) => max((float) ($sale->total ?? 0) - $this->salePaidAmount($sale), 0));
        $ordersOutstanding = $serviceOrders->sum(function (ServiceOrder $order) {
            $paid = $order->payments ? (float) $order->payments->sum('amount') : 0;

            return max((float) ($order->net_amount ?? 0) - $paid, 0);
        });

        return round($openingBalance + $salesOutstanding + $ordersOutstanding, 2);
    }

    /**
     * Paid amount for a sale, preferring the already eager-loaded `allocations`
     * collection to avoid firing one query per sale when mapping a list.
     */
    protected function salePaidAmount(Sale $sale): float
    {
        return (float) ($sale->relationLoaded('allocations') ? $sale->allocations->sum('amount') : $sale->paid_amount);
    }

    protected function mapSale(Sale $sale): array
    {
        $total = round((float) ($sale->total ?? 0), 2);
        $paid = round($this->salePaidAmount($sale), 2);

        return [
            'id' => $sale->id,
            'type' => 'sale',
            'client_id' => $sale->client_id,
            'sale_date' => $this->formatDate($sale->sale_date ?? $sale->created_at),
            'reference' => $sale->reference,
            'total_amount' => $total,
            'amount_paid' => $paid,
            'balance_due' => round(max($total - $paid, 0), 2),
            'payment_status' => $sale->payment_status,
            'status' => $sale->status,
            'client' => $sale->client,
            'client_phone' => $sale->client_phone,
            'notes' => $sale->notes,
            'created_at' => $this->formatDateTime($sale->created_at),
            'updated_at' => $this->formatDateTime($sale->updated_at),
        ];
    }

    protected function mapServiceOrder(ServiceOrder $order): array
    {
        $total = round((float) ($order->net_amount ?? 0), 2);
        $paid = round($order->payments ? (float) $order->payments->sum('amount') : 0.0, 2);

        return [
            'id' => $order->id,
            'type' => 'service_order',
            'sale_date' => $order->date?->toDateString(),
            'reference' => 'OS #'.$order->id,
            'total_amount' => $total,
            'amount_paid' => $paid,
            'balance_due' => round(max($total - $paid, 0), 2),
            'payment_status' => $order->payment_status,
            'status' => $order->status,
            'created_at' => $this->formatDateTime($order->created_at),
            'updated_at' => $this->formatDateTime($order->updated_at),
        ];
    }

    /**
     * @param  Collection  $salePaymentRows  plain arrays as built by getStatement() — one per allocation
     */
    protected function buildAllEntries(Client $client, Collection $sales, Collection $salePaymentRows, Collection $serviceOrders, Collection $servicePayments): array
    {
        $entries = collect();

        $openingBalance = round((float) ($client->opening_balance ?? 0), 2);

        if ($openingBalance !== 0.0) {
            $entries->push([
                'type' => 'opening_balance',
                'date' => $this->formatDate($client->created_at),
                'description' => 'Solde d\'ouverture',
                'sale_id' => null,
                'payment_id' => null,
                'debit' => $openingBalance > 0 ? $openingBalance : 0.0,
                'credit' => $openingBalance < 0 ? abs($openingBalance) : 0.0,
                '_sort_date' => $client->created_at,
            ]);
        }

        foreach ($sales as $sale) {
            $entries->push([
                'type' => 'sale',
                'date' => $this->formatDate($sale->sale_date ?? $sale->created_at),
                'description' => 'Vente #'.$sale->id,
                'sale_id' => $sale->id,
                'payment_id' => null,
                'debit' => round((float) ($sale->total ?? 0), 2),
                'credit' => 0.0,
                '_sort_date' => $sale->sale_date ?? $sale->created_at,
            ]);
        }

        foreach ($salePaymentRows as $row) {
            $entries->push([
                'type' => 'payment',
                'date' => $row['date'],
                'description' => 'Paiement vente #'.$row['sale_id'],
                'sale_id' => $row['sale_id'],
                'payment_id' => $row['id'],
                'debit' => 0.0,
                'credit' => round((float) ($row['amount'] ?? 0), 2),
                '_sort_date' => $row['date'] ? Carbon::parse($row['date']) : null,
            ]);
        }

        foreach ($serviceOrders as $order) {
            $entries->push([
                'type' => 'service_order',
                'date' => $this->formatDate($order->date ?? $order->created_at),
                'description' => 'Ordre de service #'.$order->id,
                'sale_id' => null,
                'service_order_id' => $order->id,
                'payment_id' => null,
                'debit' => round((float) ($order->net_amount ?? 0), 2),
                'credit' => 0.0,
                '_sort_date' => $order->date ?? $order->created_at,
            ]);
        }

        foreach ($servicePayments as $payment) {
            $entries->push([
                'type' => 'service_payment',
                'date' => $this->formatDate($payment->date ?? $payment->created_at),
                'description' => 'Paiement OS #'.$payment->service_order_id,
                'sale_id' => null,
                'service_order_id' => $payment->service_order_id,
                'payment_id' => $payment->id,
                'debit' => 0.0,
                'credit' => round((float) ($payment->amount ?? 0), 2),
                '_sort_date' => $payment->date ?? $payment->created_at,
            ]);
        }

        $runningBalance = 0.0;

        // Running balance is only meaningful computed oldest-first; the final
        // list is then reversed so the statement displays newest-first.
        return $entries
            ->sortBy(fn (array $entry) => $entry['_sort_date'] ?? null)
            ->values()
            ->map(function (array $entry) use (&$runningBalance) {
                $runningBalance = round($runningBalance + $entry['debit'] - $entry['credit'], 2);
                $entry['balance'] = $runningBalance;
                unset($entry['_sort_date']);

                return $entry;
            })
            ->reverse()
            ->values()
            ->all();
    }

    protected function sortableDate(Sale $sale): int
    {
        return ($sale->sale_date ?? $sale->created_at)?->timestamp ?? 0;
    }

    protected function sortablePaymentDate(mixed $payment): int
    {
        return ($payment->payment_date ?? $payment->paid_at ?? $payment->created_at)?->timestamp ?? 0;
    }

    protected function formatDate(mixed $value): ?string
    {
        return $value?->toDateString();
    }

    protected function formatDateTime(mixed $value): ?string
    {
        return $value?->toISOString();
    }

    protected function cleanString(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
