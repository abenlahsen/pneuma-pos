<?php

namespace App\Console\Commands;

use App\Models\KpiSnapshot;
use App\Services\DashboardKpiService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class RecalculateKpiSnapshotsCommand extends Command
{
    protected $signature = 'kpi:recalculate-snapshots
        {--from= : Date de début YYYY-MM-DD (incluse, défaut : tous)}
        {--to= : Date de fin YYYY-MM-DD (incluse, défaut : tous)}
        {--dry-run : N’écrit rien, affiche seulement les écarts détectés}';

    protected $description = 'Recalcule les snapshots KPI existants dont un champ surveillé (marge, dépenses, marge nette) a changé';

    /**
     * Fields compared to decide whether a stored snapshot is stale. Kept
     * narrow to the KPIs known to drift when the underlying formula changes
     * (e.g. Service Auto margin fix, expense-category catalog fix) rather
     * than the whole payload, so unrelated snapshot noise doesn't trigger a
     * rewrite.
     */
    private const WATCHED_FIELDS = [
        'margin_today',
        'margin_month',
        'margin_year',
        'expenses_today',
        'expenses_month',
        'expenses_year',
        'other_revenue_today',
        'other_revenue_month',
        'other_revenue_year',
        'sales_today_amount',
        'net_margin_today',
        'net_margin_month',
        'net_margin_year',
    ];

    public function handle(DashboardKpiService $service): int
    {
        $query = KpiSnapshot::query()->orderBy('snapshot_date');

        if ($from = $this->option('from')) {
            $query->where('snapshot_date', '>=', $from);
        }
        if ($to = $this->option('to')) {
            $query->where('snapshot_date', '<=', $to);
        }

        $dryRun = (bool) $this->option('dry-run');
        $snapshots = $query->get();

        if ($snapshots->isEmpty()) {
            $this->info('Aucun snapshot à recalculer.');

            return 0;
        }

        $changed = 0;

        foreach ($snapshots as $snapshot) {
            $dateStr = $snapshot->snapshot_date->toDateString();
            $oldData = $snapshot->data ?? [];
            $newData = $service->calculate(Carbon::parse($dateStr), snapshot: true);

            $diffs = [];
            foreach (self::WATCHED_FIELDS as $field) {
                $old = (float) ($oldData[$field] ?? 0);
                $new = (float) ($newData[$field] ?? 0);

                if (abs($old - $new) >= 0.01) {
                    $diffs[] = sprintf('%s %.2f → %.2f (Δ %.2f)', $field, $old, $new, $new - $old);
                }
            }

            if ($diffs !== []) {
                $changed++;
                $this->line(sprintf('%s : %s', $dateStr, implode(', ', $diffs)));

                if (! $dryRun) {
                    $snapshot->data = $newData;
                    $snapshot->save();
                }
            }
        }

        $this->info(sprintf(
            '%d snapshot(s) analysé(s), %d modifié(s)%s.',
            $snapshots->count(),
            $changed,
            $dryRun ? ' [dry-run, rien n’a été écrit]' : ''
        ));

        return 0;
    }
}
