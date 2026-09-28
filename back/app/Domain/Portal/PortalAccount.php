<?php

namespace App\Domain\Portal;

use App\Domain\Clients\ClientService;
use App\Domain\Pricing\ClientPriceResolver;
use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\Sale;
use App\Support\BusinessDate;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Le compte du client vu depuis le portail (étape 13.2) : encours, relevé,
 * documents.
 *
 * Tout part du client de la session, jamais d'un identifiant reçu : les
 * requêtes sont bornées par `client_id` ici, et un document d'un autre
 * client est introuvable (404), pas interdit (403) — le portail ne confirme
 * pas son existence.
 *
 * Ventes et ordres de service annulés sont exclus partout : un client ne
 * doit pas voir une dette qui n'existe plus. Chaque réponse est construite
 * champ par champ ; commercial, marge, prix d'achat, partenaire, notes
 * internes et lots n'en font jamais partie.
 */
class PortalAccount
{
    private const CANCELLED = 'ANNULE';

    private const SALE_STATUS_LABELS = [
        'EN COURS' => 'En cours',
        'LIVRE' => 'Livrée',
        'MONTE' => 'Montée',
        'TERMINEE' => 'Terminée',
    ];

    public function __construct(
        private ClientPriceResolver $prices,
        private ClientService $clients,
    ) {}

    /**
     * Encours, plafond, échéances.
     *
     * @return array<string, mixed>
     */
    public function summary(Client $client): array
    {
        $today = Carbon::parse(BusinessDate::today());
        $terms = (int) ($client->payment_terms_days ?? 0);
        $sales = $this->unpaidSales($client);
        $opening = round((float) ($client->opening_balance ?? 0), 2);

        $balance = round($opening + $sales->sum('remaining') + $this->serviceOrdersRemaining($client), 2);
        $limit = round((float) ($client->credit_limit ?? 0), 2);

        $overdue = $sales->filter(fn ($s) => $s->due_date->lt($today));
        $upcoming = $sales->filter(fn ($s) => $s->due_date->gte($today))->sortBy('due_date');
        $next = $upcoming->first();
        $oldestOverdue = $overdue->sortBy('due_date')->first();

        return [
            'balance_due' => $balance,
            'credit_limit' => $limit > 0 ? $limit : null,
            // null : pas de plafond fixé, ce n'est pas « plus rien de disponible ».
            'credit_left' => $limit > 0 ? round($limit - $balance, 2) : null,
            'over_limit' => $limit > 0 && $balance > $limit,
            'payment_terms_days' => $terms,
            'discount_rate' => $this->prices->discountRate($client),
            'overdue_amount' => round($overdue->sum('remaining'), 2),
            'overdue_days' => $oldestOverdue ? (int) $oldestOverdue->due_date->diffInDays($today) : 0,
            'next_due' => $next ? [
                'date' => $next->due_date->toDateString(),
                'amount' => round($upcoming->filter(fn ($s) => $s->due_date->eq($next->due_date))->sum('remaining'), 2),
            ] : null,
        ];
    }

    /**
     * Le relevé de la fiche client (16a), du plus récent au plus ancien :
     * mêmes écritures, même solde progressif que côté agence — un désaccord
     * se règle sur la même colonne. Seuls les champs listés ici sortent.
     *
     * @return array<int, array<string, mixed>>
     */
    public function statement(Client $client): array
    {
        return collect($this->clients->getStatement($client)['entries'])
            ->map(fn (array $e) => [
                'type' => $e['type'],
                'date' => $e['date'],
                'label' => $e['description'],
                'document_id' => $e['type'] === 'sale' || $e['type'] === 'payment' ? $e['sale_id'] : null,
                'debit' => (float) $e['debit'],
                'credit' => (float) $e['credit'],
                'balance' => (float) $e['balance'],
            ])
            ->all();
    }

    /**
     * Les ventes du client, pour la liste « Mes documents ».
     *
     * @return array<int, array<string, mixed>>
     */
    public function documents(Client $client): array
    {
        return $this->clientSales($client)
            ->with('allocations')
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Sale $sale) => $this->documentHeader($sale))
            ->all();
    }

    /**
     * Une vente du client, prête à imprimer (gabarit de l'étape 10). Null si
     * elle n'est pas à lui ou si elle est annulée.
     *
     * @return array<string, mixed>|null
     */
    public function document(Client $client, int $saleId): ?array
    {
        $sale = $this->clientSales($client)
            ->with(['allocations', 'items.linkedProduct.brand', 'items.linkedProduct.tyre'])
            ->find($saleId);

        if (! $sale) {
            return null;
        }

        $settings = CompanySetting::query()->first();
        $client->loadMissing('cityRelation');

        return $this->documentHeader($sale) + [
            'vat_rate' => $sale->with_invoice ? (float) ($settings?->vat_rate ?? 20) : null,
            'lines' => $sale->items->map(fn ($item) => [
                'designation' => trim(($item->linkedProduct?->brand?->name ?? '').' '.($item->linkedProduct?->profile ?? '')) ?: ($item->linkedProduct?->reference ?? 'Article'),
                'reference' => $item->linkedProduct?->reference,
                'quantity' => (int) $item->quantity,
                'unit_price' => round((float) $item->selling_price, 2),
                'discount' => round((float) ($item->discount ?? 0), 2),
                'total' => round((float) $item->total_sale, 2),
            ])->values()->all(),
            'client' => [
                'name' => $client->name,
                'address' => $client->address,
                'city' => $client->city,
                'phone' => $client->phone,
            ],
            'company' => $settings ? [
                'company_name' => $settings->company_name,
                'legal_name' => $settings->legal_name,
                'address' => $settings->address,
                'city' => $settings->city,
                'postal_code' => $settings->postal_code,
                'country' => $settings->country,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'ice' => $settings->ice,
                'rc' => $settings->rc,
                'tax_id' => $settings->tax_id,
                'patente' => $settings->patente,
                'cnss' => $settings->cnss,
                'logo_url' => $settings->logo_url,
            ] : null,
        ];
    }

    private function clientSales(Client $client)
    {
        return Sale::query()
            ->where('client_id', $client->id)
            ->where('status', '!=', self::CANCELLED);
    }

    /**
     * @return array<string, mixed>
     */
    private function documentHeader(Sale $sale): array
    {
        $total = round((float) $sale->total_sale, 2);
        $paid = round((float) $sale->allocations->sum('amount'), 2);

        return [
            'id' => $sale->id,
            'number' => (string) $sale->id,
            'kind' => $sale->with_invoice ? 'FACTURE' : 'BON DE VENTE',
            'date' => $this->day($sale->date),
            'status' => self::SALE_STATUS_LABELS[$sale->status] ?? $sale->status,
            'total' => $total,
            'paid' => $paid,
            'remaining' => round(max($total - $paid, 0), 2),
        ];
    }

    /**
     * Ventes non soldées, avec leur échéance (date + délai de paiement).
     */
    private function unpaidSales(Client $client): Collection
    {
        $terms = (int) ($client->payment_terms_days ?? 0);
        $paid = DB::table('sale_payment_allocations')
            ->selectRaw('sale_id, SUM(amount) as paid')
            ->groupBy('sale_id');

        return DB::table('sales')
            ->leftJoinSub($paid, 'alloc', 'alloc.sale_id', '=', 'sales.id')
            ->where('sales.client_id', $client->id)
            ->where('sales.status', '!=', self::CANCELLED)
            ->selectRaw('sales.id, sales.date, GREATEST(sales.total_sale - COALESCE(alloc.paid, 0), 0) as remaining')
            ->get()
            ->filter(fn ($s) => (float) $s->remaining > 0.004)
            ->map(function ($s) use ($terms) {
                $s->remaining = round((float) $s->remaining, 2);
                $s->due_date = Carbon::parse($s->date)->startOfDay()->addDays($terms);

                return $s;
            })
            ->values();
    }

    private function serviceOrdersRemaining(Client $client): float
    {
        $paid = DB::table('service_payments')
            ->selectRaw('service_order_id, SUM(amount) as paid')
            ->groupBy('service_order_id');

        return (float) DB::table('service_orders')
            ->leftJoinSub($paid, 'sp', 'sp.service_order_id', '=', 'service_orders.id')
            ->where('service_orders.client_id', $client->id)
            ->where('service_orders.status', '!=', self::CANCELLED)
            ->sum(DB::raw('GREATEST(service_orders.net_amount - COALESCE(sp.paid, 0), 0)'));
    }

    private function day(mixed $value): ?string
    {
        return $value ? Carbon::parse($value)->toDateString() : null;
    }
}
