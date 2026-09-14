<?php

namespace App\Domain\Products;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * Fiche produit (`3e` du handoff).
 *
 * Une note sur le « reserve ». La maquette pose que « 6 en stock » ne veut rien
 * dire sans « 4 reservees », et demande un disponible calcule. Dans cette
 * application le stock est decremente a la creation de la vente : ce qui reste
 * en stock EST deja le disponible, et rien n'est reserve. Le champ est donc
 * expose a zero plutot que supprime — le jour ou une reservation existera, le
 * bandeau calculera sans changer de forme.
 */
class ProductProfileService
{
    /**
     * @return array<string, mixed>
     */
    public function build(Product $product): array
    {
        $product->loadMissing(['brand', 'tyre', 'part', 'service']);

        $stock = (int) $product->stocks()->sum('quantity');
        $threshold = $product->alert_threshold ?? (int) DB::table('company_settings')->value('default_alert_threshold');

        return [
            'product' => $product,
            'stock' => [
                'quantity' => $stock,
                'threshold' => (int) $threshold,
                'reserved' => 0,
                'available' => $stock,
                'below_threshold' => $threshold > 0 && $stock <= $threshold,
                'lots' => $this->lots($product),
            ],
            'margin' => $this->margin($product),
            'history' => $this->history($product),
            'movements' => $this->movements($product),
            'prices' => $this->prices($product),
            'suppliers' => $this->suppliers($product),
        ];
    }

    /** Les lots physiques : depot, zone, DOT, quantite. */
    private function lots(Product $product): array
    {
        return $product->stocks()
            ->orderByDesc('quantity')
            ->get(['id', 'depot', 'zone', 'dot', 'made_in', 'quantity', 'purchase_price'])
            ->map(fn ($lot) => [
                'id' => $lot->id,
                'depot' => $lot->depot,
                'zone' => $lot->zone,
                'dot' => $lot->dot,
                'made_in' => $lot->made_in,
                'quantity' => (int) $lot->quantity,
                'purchase_price' => round((float) $lot->purchase_price, 2),
            ])
            ->all();
    }

    /**
     * Marge de l'article : prix d'achat moyen pondere du stock face au prix de
     * vente moyen constate sur les douze derniers mois. Les deux sont des
     * moyennes reelles, pas un tarif catalogue — c'est ce qui se pratique.
     */
    private function margin(Product $product): array
    {
        $purchase = (float) DB::table('stocks')
            ->where('product_id', $product->id)
            ->where('quantity', '>', 0)
            ->selectRaw('COALESCE(SUM(quantity * purchase_price) / NULLIF(SUM(quantity), 0), 0) AS avg')
            ->value('avg');

        $sale = (float) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sale_items.product_id', $product->id)
            ->whereNot('sales.status', 'ANNULE')
            ->where('sales.date', '>=', today()->subYear())
            ->selectRaw('COALESCE(AVG(sale_items.selling_price), 0) AS avg')
            ->value('avg');

        $margin = $sale - $purchase;

        return [
            'purchase_price' => round($purchase, 2),
            'selling_price' => round($sale, 2),
            'margin' => round($margin, 2),
            'margin_pct' => $sale > 0 ? round($margin / $sale * 100, 1) : 0.0,
        ];
    }

    /**
     * Douze mois de quantites vendues. Les mois sans vente sont completes a
     * zero : un creux doit se voir, comme sur la tendance de l'accueil.
     *
     * @return array<int, array<string, mixed>>
     */
    private function history(Product $product): array
    {
        $sold = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sale_items.product_id', $product->id)
            ->whereNot('sales.status', 'ANNULE')
            ->where('sales.date', '>=', today()->startOfMonth()->subMonths(11))
            ->groupByRaw("DATE_FORMAT(sales.date, '%Y-%m')")
            ->selectRaw("DATE_FORMAT(sales.date, '%Y-%m') AS month, SUM(sale_items.quantity) AS quantity")
            ->pluck('quantity', 'month');

        $months = [];

        for ($i = 11; $i >= 0; $i--) {
            $key = today()->startOfMonth()->subMonths($i)->format('Y-m');
            $months[] = ['month' => $key, 'quantity' => (int) ($sold[$key] ?? 0)];
        }

        return $months;
    }

    /** Derniers mouvements de stock de l'article. */
    private function movements(Product $product): array
    {
        return DB::table('stock_movements')
            ->join('stocks', 'stocks.id', '=', 'stock_movements.stock_id')
            ->where('stocks.product_id', $product->id)
            ->orderByDesc('stock_movements.created_at')
            ->limit(30)
            ->select('stock_movements.id', 'stock_movements.type', 'stock_movements.delta',
                'stock_movements.quantity_before', 'stock_movements.quantity_after',
                'stock_movements.reason', 'stock_movements.created_at', 'stocks.depot')
            ->get()
            ->map(fn ($m) => (array) $m)
            ->all();
    }

    /** Les prix de vente reellement pratiques, du plus recent au plus ancien. */
    private function prices(Product $product): array
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sale_items.product_id', $product->id)
            ->whereNot('sales.status', 'ANNULE')
            ->orderByDesc('sales.date')
            ->limit(20)
            ->select('sales.id AS sale_id', 'sales.date', 'sale_items.quantity',
                'sale_items.selling_price', 'sale_items.discount')
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();
    }

    /**
     * Fournisseurs de l'article, deduits de l'historique d'achat — aucune
     * relation produit→fournisseur n'existe, c'est le seul chemin.
     */
    private function suppliers(Product $product): array
    {
        return DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->where('purchase_items.product_id', $product->id)
            ->whereNot('purchases.status', 'ANNULE')
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderByDesc('last_date')
            ->selectRaw('suppliers.id, suppliers.name,
                COUNT(*) AS purchases,
                MAX(purchases.date) AS last_date,
                AVG(purchase_items.unit_price) AS avg_price')
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'name' => $r->name,
                'purchases' => (int) $r->purchases,
                'last_date' => $r->last_date,
                'avg_price' => round((float) $r->avg_price, 2),
            ])
            ->all();
    }
}
