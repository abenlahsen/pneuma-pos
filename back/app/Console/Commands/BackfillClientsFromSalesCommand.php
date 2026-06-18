<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Sale;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class BackfillClientsFromSalesCommand extends Command
{
    protected $signature = 'sales:backfill-clients {--dry-run : Preview what would be created/linked without writing changes}';

    protected $description = 'Create clients from existing sales rows and link sales.client_id to the created or matched clients';

    public function handle(): int
    {
        if (! Schema::hasTable('sales') || ! Schema::hasTable('clients')) {
            $this->error('Missing required sales or clients table.');

            return self::FAILURE;
        }

        if (! Schema::hasColumn('sales', 'client') || ! Schema::hasColumn('sales', 'client_phone')) {
            $this->error('This command must run before dropping sales.client and sales.client_phone.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        $sales = Sale::query()
            ->whereNull('client_id')
            ->whereNotNull('client')
            ->where('client', '!=', '')
            ->orderBy('id')
            ->get();

        if ($sales->isEmpty()) {
            $this->info('No historical sales need client backfill.');

            return self::SUCCESS;
        }

        $existingClients = Client::query()
            ->get(['id', 'name', 'phone']);

        $clientsByName = [];
        $clientsByNameAndPhone = [];

        foreach ($existingClients as $client) {
            $nameKey = $this->normalize($client->name);

            if ($nameKey === null) {
                continue;
            }

            $clientsByName[$nameKey] ??= $client->id;

            $phoneKey = $this->normalize($client->phone);

            if ($phoneKey !== null) {
                $clientsByNameAndPhone[$nameKey.'|'.$phoneKey] ??= $client->id;
            }
        }

        $processedSales = 0;
        $createdClients = 0;
        $linkedSales = 0;
        $skippedEmpty = 0;

        foreach ($sales as $sale) {
            $processedSales++;

            $name = $this->normalize($sale->getRawOriginal('client'));
            $phone = $this->normalize($sale->getRawOriginal('client_phone'));

            if ($name === null) {
                $skippedEmpty++;
                continue;
            }

            $lookupKey = $phone !== null
                ? $name.'|'.$phone
                : $name;

            $matchedClientId = $phone !== null
                ? ($clientsByNameAndPhone[$lookupKey] ?? null)
                : ($clientsByName[$lookupKey] ?? null);

            if (! $matchedClientId) {
                $clientPayload = [
                    'name' => trim((string) $sale->getRawOriginal('client')),
                    'category' => 'Particulier',
                    'phone' => $this->nullableTrim($sale->getRawOriginal('client_phone')),
                    'city' => $this->nullableTrim($sale->city),
                    'created_by' => $sale->created_by,
                    'updated_by' => $sale->updated_by,
                ];

                if (! $dryRun) {
                    $client = Client::create($clientPayload);
                    $matchedClientId = $client->id;
                } else {
                    $matchedClientId = -1 * ($processedSales + $createdClients);
                }

                $createdClients++;

                $clientsByName[$name] ??= $matchedClientId;

                if ($phone !== null) {
                    $clientsByNameAndPhone[$lookupKey] ??= $matchedClientId;
                }
            }

            if (! $dryRun) {
                $sale->update([
                    'client_id' => $matchedClientId > 0 ? $matchedClientId : null,
                ]);
            }

            $linkedSales++;
        }

        $this->info($dryRun ? 'Dry run complete.' : 'Backfill complete.');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Sales scanned', $sales->count()],
                ['Sales processed', $processedSales],
                ['Sales linked', $linkedSales],
                ['Clients created', $createdClients],
                ['Skipped empty names', $skippedEmpty],
            ]
        );

        return self::SUCCESS;
    }

    protected function normalize(mixed $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        $value = preg_replace('/\s+/', ' ', $value);

        return mb_strtolower($value ?? '');
    }

    protected function nullableTrim(mixed $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
