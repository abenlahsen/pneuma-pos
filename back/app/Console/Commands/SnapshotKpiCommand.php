<?php

namespace App\Console\Commands;

use App\Models\KpiSnapshot;
use App\Services\DashboardKpiService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SnapshotKpiCommand extends Command
{
    protected $signature = 'kpi:snapshot {--date= : Date YYYY-MM-DD (défaut : hier)}';
    protected $description = 'Capture un snapshot quotidien des KPIs du dashboard';

    public function handle(DashboardKpiService $service): int
    {
        $date = $this->option('date')
            ? Carbon::parse($this->option('date'))
            : Carbon::yesterday();

        $dateStr = $date->toDateString();

        if (KpiSnapshot::where('snapshot_date', $dateStr)->exists()) {
            $this->info("Snapshot du {$dateStr} déjà existant, ignoré.");
            return 0;
        }

        $data = $service->calculate($date, snapshot: true);

        KpiSnapshot::create([
            'snapshot_date' => $dateStr,
            'data'          => $data,
        ]);

        $this->info("Snapshot du {$dateStr} créé avec succès.");
        return 0;
    }
}
