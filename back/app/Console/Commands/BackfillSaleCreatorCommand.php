<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Sale;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillSaleCreatorCommand extends Command
{
    protected $signature = 'sales:backfill-creator
        {--from= : Date de création de vente minimale à traiter (YYYY-MM-DD, incluse)}
        {--to= : Date de création de vente maximale à traiter (YYYY-MM-DD, incluse)}
        {--dry-run : N’écrit rien, affiche seulement ce qui serait modifié}';

    protected $description = 'Rattrape le champ created_by des ventes historiques (régression du 21/04 au 03/08/2026) '
        .'à partir du journal d\'activité (activity_logs), sans toucher aux ventes sans trace exploitable';

    public function handle(): int
    {
        $query = Sale::query()->whereNull('created_by');

        if ($from = $this->option('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $this->option('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $sales = $query->get(['id', 'created_at']);

        if ($sales->isEmpty()) {
            $this->info('Aucune vente sans créateur à traiter.');

            return self::SUCCESS;
        }

        $logs = ActivityLog::query()
            ->where('entity_type', ActivityLog::ENTITY_VENTE)
            ->where('action', ActivityLog::ACTION_CREATE)
            ->whereIn('entity_id', $sales->pluck('id'))
            ->whereNotNull('user_id')
            ->get(['entity_id', 'user_id'])
            ->keyBy('entity_id');

        $dryRun = (bool) $this->option('dry-run');
        $updated = 0;
        $skipped = 0;

        foreach ($sales as $sale) {
            $log = $logs->get($sale->id);

            if (! $log) {
                $skipped++;

                continue;
            }

            $this->line(sprintf(
                '%s Vente #%d -> created_by = %d',
                $dryRun ? '[dry-run]' : '[OK]',
                $sale->id,
                $log->user_id
            ));

            if (! $dryRun) {
                // Écriture directe via le query builder (pas Eloquent) pour ne
                // pas réémettre `updated_at` sur des ventes qui n'ont pas
                // réellement été modifiées aujourd'hui.
                DB::table('sales')->where('id', $sale->id)->update(['created_by' => $log->user_id]);
            }

            $updated++;
        }

        $this->newLine();
        $this->info(sprintf(
            '%s%d vente(s) rattachée(s) à leur créateur, %d sans trace exploitable dans le journal d\'activité.',
            $dryRun ? '[dry-run] ' : '',
            $updated,
            $skipped
        ));

        return self::SUCCESS;
    }
}
