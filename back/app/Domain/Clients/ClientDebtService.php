<?php

namespace App\Domain\Clients;

use App\Models\Client;
use Illuminate\Support\Facades\DB;

/**
 * Refonte 2b — l'âge de la dette client et le délai de paiement réellement
 * observé (README, écran « Refonte Client » et « Gestion d'état »).
 *
 * Ces deux mesures ne sont stockées nulle part : elles se recalculent sur les
 * ventes et leurs paiements. Le délai réel sert aussi à la projection de
 * trésorerie du Cash Flow, qui passe par ce même service pour que les deux
 * écrans ne puissent pas diverger.
 */
class ClientDebtService
{
    /** Repli quand ni l'historique ni le contrat ne disent rien. */
    public const DEFAULT_DELAY_DAYS = 30;

    /** Nombre minimum de ventes soldées avant de parler de délai « observé ». */
    private const MIN_HISTORY = 2;

    /**
     * Répartition de ce que doit un client par tranche d'ancienneté, l'âge
     * étant compté depuis la date de la vente.
     *
     * @return array<string, mixed>
     */
    public function aging(Client $client): array
    {
        $rows = $this->unpaidSaleRows($client->id);

        $buckets = ['0-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0];

        foreach ($rows as $row) {
            $remaining = round((float) $row->remaining, 2);
            if ($remaining <= 0.004) {
                continue;
            }

            $days = (int) $row->days;
            $key = match (true) {
                $days <= 30 => '0-30',
                $days <= 60 => '31-60',
                $days <= 90 => '61-90',
                default => '90+',
            };

            $buckets[$key] += $remaining;
        }

        $total = array_sum($buckets);
        $creditLimit = round((float) ($client->credit_limit ?? 0), 2);

        return [
            'buckets' => array_map(fn ($amount) => round($amount, 2), $buckets),
            'total' => round($total, 2),
            'credit_limit' => $creditLimit,
            // Crédit restant : null quand aucune limite n'est fixée — zéro
            // voudrait dire « plus rien de disponible », ce n'est pas la même
            // chose qu'une limite non renseignée.
            'credit_left' => $creditLimit > 0 ? round($creditLimit - $total, 2) : null,
        ];
    }

    /**
     * Délai de paiement : celui réellement observé sur les ventes déjà soldées
     * du client, face au délai contractuel de sa fiche.
     *
     * @return array<string, mixed>
     */
    public function paymentDelay(Client $client): array
    {
        $observed = $this->observedDelayDays($client->id);

        return [
            'contractual_days' => $client->payment_terms_days !== null ? (int) $client->payment_terms_days : null,
            'observed_days' => $observed['days'],
            'observed_sample' => $observed['sample'],
        ];
    }

    /**
     * Délai à retenir pour projeter un encaissement : l'observé s'il repose sur
     * assez d'historique, sinon le contractuel, sinon la moyenne de la maison.
     */
    public function projectionDelayDays(?int $clientId, ?Client $client = null): int
    {
        if ($clientId !== null) {
            $observed = $this->observedDelayDays($clientId);
            if ($observed['days'] !== null) {
                return $observed['days'];
            }
        }

        if ($client?->payment_terms_days) {
            return (int) $client->payment_terms_days;
        }

        return $this->globalAverageDelayDays();
    }

    /**
     * @return array{days: int|null, sample: int}
     */
    public function observedDelayDays(int $clientId): array
    {
        $row = $this->settledSalesQuery()
            ->where('sales.client_id', $clientId)
            ->selectRaw('COUNT(*) as n, AVG(DATEDIFF(lp.last_payment_date, sales.date)) as avg_days')
            ->first();

        $sample = (int) ($row->n ?? 0);

        if ($sample < self::MIN_HISTORY || $row->avg_days === null) {
            return ['days' => null, 'sample' => $sample];
        }

        return ['days' => max(0, (int) round((float) $row->avg_days)), 'sample' => $sample];
    }

    public function globalAverageDelayDays(): int
    {
        $row = $this->settledSalesQuery()
            ->selectRaw('AVG(DATEDIFF(lp.last_payment_date, sales.date)) as avg_days')
            ->first();

        return $row && $row->avg_days !== null
            ? max(0, (int) round((float) $row->avg_days))
            : self::DEFAULT_DELAY_DAYS;
    }

    /**
     * Ventes soldées, jointes à la date du dernier paiement qui leur est
     * réellement affecté. On passe par sale_payment_allocations et non par
     * payments.sale_id : un paiement multi-ventes laisse sale_id à NULL et
     * n'existe qu'à travers ses allocations.
     */
    private function settledSalesQuery()
    {
        $lastPayment = DB::table('sale_payment_allocations as spa')
            ->join('payments', 'payments.id', '=', 'spa.payment_id')
            ->selectRaw('spa.sale_id, MAX(payments.date) as last_payment_date')
            ->groupBy('spa.sale_id');

        return DB::table('sales')
            ->joinSub($lastPayment, 'lp', 'lp.sale_id', '=', 'sales.id')
            ->where('sales.payment_status', 'PAYE')
            ->where('sales.status', '!=', 'ANNULE');
    }

    private function unpaidSaleRows(int $clientId)
    {
        $paid = DB::table('sale_payment_allocations')
            ->selectRaw('sale_id, SUM(amount) as paid')
            ->groupBy('sale_id');

        return DB::table('sales')
            ->leftJoinSub($paid, 'alloc', 'alloc.sale_id', '=', 'sales.id')
            ->where('sales.client_id', $clientId)
            ->where('sales.payment_status', '!=', 'PAYE')
            ->where('sales.status', '!=', 'ANNULE')
            ->selectRaw('
                GREATEST(sales.total_sale - COALESCE(alloc.paid, 0), 0) as remaining,
                DATEDIFF(CURDATE(), sales.date) as days
            ')
            ->get();
    }
}
