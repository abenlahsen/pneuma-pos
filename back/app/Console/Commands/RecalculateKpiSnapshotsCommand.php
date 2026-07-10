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

    protected $description = 'Recalcule les snapshots KPI existants avec la formule de marge Service Auto corrigée';

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

            $oldMargin = (float) ($oldData['margin_today'] ?? 0);
            $newMargin = (float) ($newData['margin_today'] ?? 0);

            if (abs($oldMargin - $newMargin) >= 0.01) {
                $changed++;
                $this->line(sprintf(
                    '%s : marge_today %.2f → %.2f (Δ %.2f)',
                    $dateStr,
                    $oldMargin,
                    $newMargin,
                    $newMargin - $oldMargin
                ));

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
