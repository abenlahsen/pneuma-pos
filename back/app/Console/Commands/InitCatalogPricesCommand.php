<?php

namespace App\Console\Commands;

use App\Domain\Pricing\CatalogPriceInitializer;
use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Initialise le prix catalogue, une seule fois.
 *
 * Refuse de tourner si un produit a déjà un prix catalogue : les prix saisis
 * ensuite dans la fiche produit ne doivent pas être écrasés par erreur.
 * `--force` passe outre ; il ne remplit alors que les produits encore sans
 * prix, sauf avec `--overwrite`.
 */
class InitCatalogPricesCommand extends Command
{
    protected $signature = 'pricing:init-catalog
        {--coefficient=1.25 : Coefficient appliqué au prix d\'achat du dernier lot, à défaut de ventes}
        {--dry-run : Affiche le résultat sans rien écrire}
        {--force : Tourne même si des prix catalogue existent déjà (ne remplit que les produits sans prix)}
        {--overwrite : Avec --force, remplace aussi les prix existants}';

    protected $description = 'Initialise le prix catalogue : médiane des ventes à 90 jours, à défaut prix d\'achat du dernier lot × coefficient';

    public function handle(CatalogPriceInitializer $initializer): int
    {
        $coefficient = (float) str_replace(',', '.', (string) $this->option('coefficient'));
        if ($coefficient <= 0) {
            $this->error('Le coefficient doit être positif.');

            return self::FAILURE;
        }

        $alreadyPriced = Product::query()->whereNotNull('catalog_price')->count();
        if ($alreadyPriced > 0 && ! $this->option('force')) {
            $this->error("{$alreadyPriced} produit(s) ont déjà un prix catalogue : l'initialisation a déjà eu lieu. Relancez avec --force pour compléter les produits sans prix.");

            return self::FAILURE;
        }

        $plan = $initializer->plan($coefficient);
        $overwrite = (bool) $this->option('overwrite');
        $existing = Product::query()->whereNotNull('catalog_price')->pluck('id')->flip();

        $counts = [CatalogPriceInitializer::METHOD_MEDIAN => 0, CatalogPriceInitializer::METHOD_PURCHASE => 0, 'none' => 0, 'kept' => 0];
        $writes = [];
        foreach ($plan as $productId => $entry) {
            if (isset($existing[$productId]) && ! $overwrite) {
                $counts['kept']++;

                continue;
            }
            if ($entry['price'] === null) {
                $counts['none']++;

                continue;
            }
            $counts[$entry['method']]++;
            $writes[$productId] = $entry['price'];
        }

        if (! $this->option('dry-run')) {
            DB::transaction(function () use ($writes) {
                foreach ($writes as $productId => $price) {
                    Product::whereKey($productId)->update(['catalog_price' => $price]);
                }
            });
        }

        $this->table(['Méthode', 'Produits'], [
            ['Médiane des ventes à 90 jours', $counts[CatalogPriceInitializer::METHOD_MEDIAN]],
            ["Prix d'achat du dernier lot × {$coefficient}", $counts[CatalogPriceInitializer::METHOD_PURCHASE]],
            ['Sans prix (hors portail)', $counts['none']],
            ['Déjà pourvus, conservés', $counts['kept']],
        ]);
        $this->info($this->option('dry-run') ? 'Simulation : rien n\'a été écrit.' : count($writes).' prix catalogue écrits.');

        return self::SUCCESS;
    }
}
