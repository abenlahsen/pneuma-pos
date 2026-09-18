<?php

namespace App\Domain\CashFlow;

use App\Domain\Accounts\AccountService;
use App\Domain\Clients\ClientDebtService;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Refonte 2b — Cash Flow, projection à 6 semaines (README « Le solde projeté »).
 *
 * La projection ne fabrique aucune donnée : elle ne fait que dater trois
 * catégories d'échéances déjà réelles dans le système et les répartit par
 * semaine autour du solde de trésorerie actuel.
 *
 * - Achats impayés : datés à `date + délai contractuel du fournisseur`
 *   (Supplier::payment_terms_days). Sans délai renseigné, repli sur
 *   DEFAULT_SUPPLIER_TERMS_DAYS — un vrai fournisseur sans délai saisi
 *   n'a pas de date d'échéance connue, ce repli est une approximation
 *   assumée, pas une donnée observée.
 * - Ventes impayées : datées à `date + délai réel observé du client`,
 *   calculé sur l'historique de ses ventes déjà soldées (moyenne
 *   MAX(date de paiement) − date de vente). Sans historique suffisant,
 *   repli sur Client::payment_terms_days, puis sur la moyenne globale
 *   observée. Cette règle est portée par ClientDebtService, que la fiche
 *   client utilise aussi : les deux écrans ne peuvent pas diverger.
 * - Charges récurrentes : moyenne hebdomadaire des dépenses réelles des
 *   trois derniers mois pleins (hors catégorie Transfert) — pas de liste
 *   figée de catégories « récurrentes », qui n'existe pas dans le modèle.
 */
class CashFlowProjectionService
{
    private const WEEKS_AHEAD = 6;
    private const DEFAULT_SUPPLIER_TERMS_DAYS = 30;
    private const TRANSFER_CATEGORY = 'Transfert';

    /**
     * Catégories exclues de la moyenne des « charges récurrentes ».
     *
     * `Achat marchandise` est la catégorie posée automatiquement par les
     * règlements d'achats : ces sorties sont déjà projetées une par une à partir
     * des achats impayés et de leur échéance. Les lisser en plus dans la moyenne
     * les compterait deux fois. `Transfert` n'est pas une dépense mais un
     * mouvement interne entre comptes.
     */
    private const NON_RECURRING_CATEGORIES = [
        self::TRANSFER_CATEGORY,
        'Achat marchandise',
    ];

    public function __construct(
        private AccountService $accountService,
        private ClientDebtService $clientDebt,
    ) {}

    public function build(): array
    {
        $accounts = collect($this->accountService->list(['is_active' => true, 'all' => true]));
        $todayBalance = round((float) $accounts->sum(fn ($a) => (float) $a->current_balance), 2);

        $weekStart = Carbon::today()->startOfWeek(Carbon::MONDAY);
        $weeks = [];
        for ($i = 0; $i < self::WEEKS_AHEAD; $i++) {
            $start = $weekStart->copy()->addWeeks($i);
            $weeks[] = [
                'start' => $start->toDateString(),
                'end' => $start->copy()->addDays(6)->toDateString(),
                'label' => 'S'.$start->isoWeek().' · '.$start->format('d/m'),
                'inflow' => 0.0,
                'outflow' => 0.0,
            ];
        }

        $supplierDue = 0.0;
        $clientDue = 0.0;

        Purchase::query()
            ->whereIn('payment_status', ['NON PAYE', 'PARTIEL'])
            ->where('status', '!=', 'ANNULE')
            ->with('supplier')
            ->withSum('allocations', 'amount')
            ->withSum('returns', 'refund_amount')
            ->chunkById(200, function ($purchases) use (&$weeks, &$supplierDue, $weekStart) {
                foreach ($purchases as $purchase) {
                    $netPaid = (float) ($purchase->allocations_sum_amount ?? 0)
                        - (float) ($purchase->returns_sum_refund_amount ?? 0);
                    $remaining = round(max($purchase->effectiveNetAmount() - $netPaid, 0), 2);
                    if ($remaining <= 0.004) {
                        continue;
                    }

                    $supplierDue += $remaining;

                    $termDays = $purchase->supplier?->payment_terms_days ?? self::DEFAULT_SUPPLIER_TERMS_DAYS;
                    $due = Carbon::parse($purchase->date)->addDays($termDays);
                    $this->bucket($weeks, $weekStart, $due, $remaining, 'outflow');
                }
            });

        $clientDelayCache = [];

        Sale::query()
            ->whereIn('payment_status', ['NON PAYE', 'PARTIEL'])
            ->where('status', '!=', 'ANNULE')
            ->whereNotNull('client_id')
            ->with('linkedClient')
            ->withSum('allocations', 'amount')
            ->chunkById(200, function ($sales) use (&$weeks, &$clientDue, &$clientDelayCache, $weekStart) {
                foreach ($sales as $sale) {
                    $remaining = round(max((float) $sale->total_sale - (float) ($sale->allocations_sum_amount ?? 0), 0), 2);
                    if ($remaining <= 0.004) {
                        continue;
                    }

                    $clientDue += $remaining;

                    $clientId = $sale->client_id;
                    if (! array_key_exists($clientId, $clientDelayCache)) {
                        $clientDelayCache[$clientId] = $this->clientDebt->projectionDelayDays($clientId, $sale->linkedClient);
                    }

                    $due = Carbon::parse($sale->date)->addDays($clientDelayCache[$clientId]);
                    $this->bucket($weeks, $weekStart, $due, $remaining, 'inflow');
                }
            });

        // Chèques et effets déjà enregistrés mais pas encore encaissés : ils ne
        // sont pas dans le solde du jour (Account::current_balance ne compte que
        // le réglé) et plus dans les impayés (leur allocation est déjà passée) —
        // sans cette étape ils disparaîtraient de la projection.
        Transaction::query()
            ->pending()
            ->get(['date', 'amount', 'type'])
            ->each(function ($transaction) use (&$weeks, $weekStart) {
                $amount = round((float) $transaction->amount, 2);
                if ($amount <= 0.004) {
                    return;
                }

                $this->bucket(
                    $weeks,
                    $weekStart,
                    Carbon::parse($transaction->date),
                    $amount,
                    $transaction->type === 'income' ? 'inflow' : 'outflow',
                );
            });

        $recurringWeekly = $this->averageRecurringWeeklyExpense();
        foreach ($weeks as &$week) {
            $week['outflow'] = round($week['outflow'] + $recurringWeekly, 2);
        }
        unset($week);

        $balance = $todayBalance;
        $lowPoint = null;
        foreach ($weeks as &$week) {
            $net = round($week['inflow'] - $week['outflow'], 2);
            $balance = round($balance + $net, 2);
            $week['net'] = $net;
            $week['balance'] = $balance;
            if ($lowPoint === null || $balance < $lowPoint['balance']) {
                $lowPoint = ['label' => $week['label'], 'start' => $week['start'], 'balance' => $balance];
            }
        }
        unset($week);

        return [
            'today_balance' => $todayBalance,
            'weeks' => $weeks,
            'low_point' => $lowPoint,
            'in_play' => [
                'supplier_due' => round($supplierDue, 2),
                'client_due' => round($clientDue, 2),
                'net_position' => round($clientDue - $supplierDue, 2),
            ],
            'expenses_by_category' => $this->expensesByCategoryThisMonth(),
            'recurring_weekly_estimate' => $recurringWeekly,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $weeks
     */
    private function bucket(array &$weeks, Carbon $weekStart, Carbon $due, float $amount, string $direction): void
    {
        $index = (int) floor($weekStart->diffInDays($due, false) / 7);
        $index = max(0, min(count($weeks) - 1, $index));
        $weeks[$index][$direction] = round($weeks[$index][$direction] + $amount, 2);
    }

    private function averageRecurringWeeklyExpense(): float
    {
        $end = Carbon::today()->startOfMonth();
        $start = $end->copy()->subMonths(3);

        $total = (float) Transaction::query()
            ->settled()
            ->where('type', 'expense')
            ->where(fn ($q) => $q->whereNull('category')->orWhereNotIn('category', self::NON_RECURRING_CATEGORIES))
            ->whereBetween('date', [$start->toDateString(), $end->copy()->subDay()->toDateString()])
            ->sum('amount');

        return round(($total / 3) / 4.345, 2);
    }

    private function expensesByCategoryThisMonth(): array
    {
        $start = Carbon::today()->startOfMonth();
        $end = Carbon::today()->endOfMonth();

        $rows = Transaction::query()
            ->where('type', 'expense')
            ->where(fn ($q) => $q->whereNull('category')->orWhere('category', '!=', self::TRANSFER_CATEGORY))
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw("COALESCE(category, 'Autres') as category, SUM(amount) as amount")
            ->groupBy('category')
            ->orderByDesc('amount')
            ->get();

        return $rows->map(fn ($r) => [
            'category' => $r->category,
            'amount' => round((float) $r->amount, 2),
        ])->values()->all();
    }
}
