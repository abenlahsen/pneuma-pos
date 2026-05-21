<?php

namespace App\Domain\Clients;

use App\Models\City;
use App\Models\Client;
use App\Models\Sale;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
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
            'sales' => fn ($query) => $query->with(['linkedClient', 'payments'])->latest('date')->latest('id'),
        ]);

        $sales = $client->sales->values();
        $latestSale = $sales->sortByDesc(fn (Sale $sale) => $this->sortableDate($sale))->first();
        $salesHistory = $sales->map(fn (Sale $sale) => $this->mapSale($sale))->values();

        return [
            'client' => $client,
            'sales_count' => $sales->count(),
            'total_purchased' => round((float) $sales->sum('total'), 2),
            'last_sale_date' => optional($latestSale)->sale_date ?? optional($latestSale)->created_at,
            'outstanding_balance' => $this->calculateOutstandingBalance($client, $sales),
            'sales' => $salesHistory,
            'sales_history' => $salesHistory,
        ];
    }

    public function getStatement(Client $client): array
    {
        $client->loadMissing([
            'sales' => fn ($query) => $query->with(['payments', 'linkedClient'])->latest('date')->latest('id'),
        ]);

        $sales = $client->sales->values();
        $latestSale = $sales->sortByDesc(fn (Sale $sale) => $this->sortableDate($sale))->first();
        $salesRows = $sales->map(fn (Sale $sale) => $this->mapSale($sale))->values();

        $payments = $sales
            ->flatMap(fn (Sale $sale) => $sale->payments ?? collect())
            ->sortBy(fn ($payment) => $this->sortablePaymentDate($payment))
            ->values();

        $paymentRows = $payments->map(function ($payment) {
            return [
                'id' => $payment->id,
                'sale_id' => $payment->sale_id,
                'date' => $this->formatDate($payment->payment_date ?? $payment->paid_at ?? $payment->created_at),
                'amount' => round((float) ($payment->amount ?? $payment->amount_paid ?? 0), 2),
                'payment_method' => $payment->payment_method ?? $payment->method ?? null,
                'notes' => $payment->notes,
                'created_at' => $this->formatDateTime($payment->created_at),
                'updated_at' => $this->formatDateTime($payment->updated_at),
            ];
        })->values();

        $summary = [
            'sales_count' => $sales->count(),
            'payments_count' => $payments->count(),
            'opening_balance' => round((float) ($client->opening_balance ?? 0), 2),
            'total_sales' => round((float) $sales->sum('total'), 2),
            'total_paid' => round((float) $sales->sum('paid_amount'), 2),
            'outstanding_balance' => $this->calculateOutstandingBalance($client, $sales),
            'last_sale_date' => $this->formatDate(optional($latestSale)->sale_date ?? optional($latestSale)->created_at),
        ];

        return [
            'client' => $client,
            'summary' => $summary,
            'sales' => $salesRows,
            'payments' => $paymentRows,
            'entries' => $this->buildEntries($client, $sales, $payments),
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
        $openingBalance = (float) ($client->opening_balance ?? 0);
        $salesOutstanding = $sales->sum(function (Sale $sale) {
            return max((float) ($sale->total ?? 0) - (float) ($sale->paid_amount ?? 0), 0);
        });

        return round($openingBalance + $salesOutstanding, 2);
    }

    protected function mapSale(Sale $sale): array
    {
        return [
            'id' => $sale->id,
            'client_id' => $sale->client_id,
            'date' => $this->formatDate($sale->sale_date ?? $sale->created_at),
            'subtotal' => round((float) ($sale->subtotal ?? 0), 2),
            'discount' => round((float) ($sale->discount ?? 0), 2),
            'tax' => round((float) ($sale->tax ?? 0), 2),
            'total' => round((float) ($sale->total ?? 0), 2),
            'paid_amount' => round((float) ($sale->paid_amount ?? 0), 2),
            'outstanding_amount' => round(max((float) ($sale->total ?? 0) - (float) ($sale->paid_amount ?? 0), 0), 2),
            'payment_method' => $sale->payment_method,
            'status' => $sale->status,
            'client' => $sale->client,
            'client_phone' => $sale->client_phone,
            'city' => $sale->city,
            'notes' => $sale->notes,
            'created_at' => $this->formatDateTime($sale->created_at),
            'updated_at' => $this->formatDateTime($sale->updated_at),
        ];
    }

    protected function buildEntries(Client $client, Collection $sales, Collection $payments): array
    {
        $entries = collect();

        $openingBalance = round((float) ($client->opening_balance ?? 0), 2);

        if ($openingBalance !== 0.0) {
            $entries->push([
                'type' => 'opening_balance',
                'date' => $this->formatDate($client->created_at),
                'description' => 'Opening balance',
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
                'description' => 'Sale #'.$sale->id,
                'sale_id' => $sale->id,
                'payment_id' => null,
                'debit' => round((float) ($sale->total ?? 0), 2),
                'credit' => 0.0,
                '_sort_date' => $sale->sale_date ?? $sale->created_at,
            ]);
        }

        foreach ($payments as $payment) {
            $entries->push([
                'type' => 'payment',
                'date' => $this->formatDate($payment->payment_date ?? $payment->paid_at ?? $payment->created_at),
                'description' => 'Payment #'.$payment->id,
                'sale_id' => $payment->sale_id,
                'payment_id' => $payment->id,
                'debit' => 0.0,
                'credit' => round((float) ($payment->amount ?? $payment->amount_paid ?? 0), 2),
                '_sort_date' => $payment->payment_date ?? $payment->paid_at ?? $payment->created_at,
            ]);
        }

        $runningBalance = 0.0;

        return $entries
            ->sortBy(fn (array $entry) => $entry['_sort_date'] ?? null)
            ->values()
            ->map(function (array $entry) use (&$runningBalance) {
                $runningBalance = round($runningBalance + $entry['debit'] - $entry['credit'], 2);
                $entry['balance'] = $runningBalance;
                unset($entry['_sort_date']);

                return $entry;
            })
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
