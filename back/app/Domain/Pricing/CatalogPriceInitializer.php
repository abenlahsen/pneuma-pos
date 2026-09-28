<?php

namespace App\Domain\Pricing;

use App\Models\Product;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Calcule le prix catalogue initial de chaque produit (commande
 * `pricing:init-catalog`, lancée une fois).
 *
 * 1. La médiane des prix de vente des 90 derniers jours : le prix réellement
 *    facturé par ligne (total de la ligne ÷ quantité, remise de ligne
 *    comprise), ventes annulées exclues. Une médiane, pas une moyenne : une
 *    vente bradée ou une erreur de saisie ne tire pas le prix.
 * 2. À défaut, le prix d'achat du dernier lot (le plus récent, prix non nul)
 *    × un coefficient (1,25 par défaut).
 * 3. Sinon, pas de prix : le produit reste hors portail.
 *
 * Les services ont leur propre prix (product_services.selling_price) et ne
 * sont pas concernés.
 */
class CatalogPriceInitializer
{
    public const METHOD_MEDIAN = 'median';

    public const METHOD_PURCHASE = 'purchase';

    /**
     * @return array<int, array{price: float|null, method: string|null}> indexé par product_id
     */
    public function plan(float $coefficient, ?Carbon $today = null, int $days = 90): array
    {
        $since = ($today ?? Carbon::today())->copy()->subDays($days)->toDateString();

        $productIds = Product::query()->whereIn('type', ['tyre', 'part'])->pluck('id');

        $medians = $this->medianSellingPrices($since);
        $lastPurchase = $this->lastLotPurchasePrices();

        $plan = [];
        foreach ($productIds as $id) {
            if (isset($medians[$id])) {
                $plan[$id] = ['price' => $medians[$id], 'method' => self::METHOD_MEDIAN];
            } elseif (isset($lastPurchase[$id])) {
                $plan[$id] = ['price' => round($lastPurchase[$id] * $coefficient, 2), 'method' => self::METHOD_PURCHASE];
            } else {
                $plan[$id] = ['price' => null, 'method' => null];
            }
        }

        return $plan;
    }

    /**
     * @return array<int, float>
     */
    private function medianSellingPrices(string $since): array
    {
        $rows = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.date', '>=', $since)
            ->where('sales.status', '!=', 'ANNULE')
            ->where('sale_items.quantity', '>', 0)
            ->where('sale_items.total_sale', '>', 0)
            ->whereNotNull('sale_items.product_id')
            ->select('sale_items.product_id', 'sale_items.total_sale', 'sale_items.quantity')
            ->get();

        $prices = [];
        foreach ($rows as $row) {
            $prices[(int) $row->product_id][] = (float) $row->total_sale / (int) $row->quantity;
        }

        return array_map(fn (array $values) => round(self::median($values), 2), $prices);
    }

    /**
     * @return array<int, float>
     */
    private function lastLotPurchasePrices(): array
    {
        $latest = DB::table('stocks')
            ->where('purchase_price', '>', 0)
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->selectRaw('product_id, MAX(id) as stock_id');

        return DB::table('stocks')
            ->joinSub($latest, 'latest', fn ($join) => $join->on('stocks.id', '=', 'latest.stock_id'))
            ->pluck('stocks.purchase_price', 'stocks.product_id')
            ->map(fn ($price) => (float) $price)
            ->all();
    }

    /**
     * @param  array<int, float>  $values
     */
    public static function median(array $values): float
    {
        sort($values);
        $count = count($values);
        $middle = intdiv($count, 2);

        return $count % 2 === 1
            ? $values[$middle]
            : ($values[$middle - 1] + $values[$middle]) / 2;
    }
}
