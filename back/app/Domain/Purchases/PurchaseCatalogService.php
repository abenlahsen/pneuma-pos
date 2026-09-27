<?php

namespace App\Domain\Purchases;

use App\Enums\PurchaseStatus;
use App\Models\Product;
use App\Models\Stock;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * La recherche de la saisie d'achat — refonte 2b, 12b, maquette 20b.
 *
 * Ce que le volet de gauche et les lignes ont besoin de savoir d'un produit
 * au moment d'acheter :
 *
 *  - ses lots, parce qu'une ligne d'achat entre dans un lot existant (le
 *    « dépôt de réception ») ;
 *  - son dernier prix d'achat, tous fournisseurs confondus, et chez le
 *    fournisseur choisi — c'est ce qui permet de signaler une hausse pendant
 *    la saisie ;
 *  - son dernier prix de vente. Le catalogue ne porte aucun prix de vente
 *    pour un pneu ou une pièce (seules les prestations en ont un) : le
 *    dernier prix facturé est la seule référence qui existe pour dire la
 *    marge que laisse un prix d'achat.
 *
 * Les prix d'achat comparés sont les prix unitaires de ligne, avant la
 * remise globale de l'achat : c'est le prix que l'on saisit.
 */
class PurchaseCatalogService
{
    private const LIMIT = 40;

    /**
     * @param  array{q?: string|null, supplier_id?: int|null, ids?: array<int>, exclude_purchase_id?: int|null}  $filters
     * @return array<int, array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $supplierId = ! empty($filters['supplier_id']) ? (int) $filters['supplier_id'] : null;
        $excludePurchaseId = ! empty($filters['exclude_purchase_id']) ? (int) $filters['exclude_purchase_id'] : null;
        $ids = array_values(array_filter(array_map('intval', $filters['ids'] ?? [])));
        $q = trim((string) ($filters['q'] ?? ''));

        $query = Product::query()
            ->whereIn('type', ['tyre', 'part'])
            ->with([
                'brand',
                'tyre',
                'stocks' => fn ($s) => $s->select('id', 'product_id', 'depot', 'zone', 'dot', 'quantity', 'purchase_price')->orderBy('id'),
            ]);

        if ($ids !== []) {
            // Les lignes d'un achat déjà saisi : leurs produits, actifs ou non.
            $query->whereIn('id', $ids);
        } else {
            $query->where('is_active', true);

            if ($q !== '') {
                $this->applySearch($query, $q);
            } elseif ($supplierId) {
                // Sans recherche, les produits déjà achetés chez ce fournisseur.
                $query->whereIn('id', DB::table('purchase_items')
                    ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
                    ->where('purchases.supplier_id', $supplierId)
                    ->select('purchase_items.product_id'));
            } else {
                return [];
            }
        }

        $products = $query->orderBy('profile')->limit(self::LIMIT)->get();
        if ($products->isEmpty()) {
            return [];
        }

        $productIds = $products->pluck('id')->all();
        $purchases = $this->purchaseHistory($productIds, $excludePurchaseId);
        $lastSales = $this->lastSalePrices($productIds);

        $rows = $products->map(function (Product $product) use ($purchases, $lastSales, $supplierId) {
            $history = $purchases->get($product->id, collect());
            $last = $history->first();
            $fromSupplier = $supplierId ? $history->firstWhere('supplier_id', $supplierId) : null;

            return [
                'id' => $product->id,
                'type' => $product->type,
                'brand' => $product->brand?->name,
                'profile' => $product->profile,
                'reference' => $product->reference,
                'dimension' => $this->dimension($product),
                'stock_total' => (int) $product->stocks->sum('quantity'),
                'lots' => $product->stocks->map(fn (Stock $s) => [
                    'id' => $s->id,
                    'depot' => $s->depot,
                    'zone' => $s->zone,
                    'dot' => $s->dot,
                    'quantity' => (int) $s->quantity,
                    'purchase_price' => (float) $s->purchase_price,
                ])->values()->all(),
                'last_purchase' => $last ? $this->purchaseRow($last) : null,
                'supplier_last_purchase' => $fromSupplier ? $this->purchaseRow($fromSupplier) : null,
                'bought_from_supplier' => $fromSupplier !== null,
                'last_sale_price' => $lastSales->get($product->id),
            ];
        });

        // Les produits déjà achetés chez ce fournisseur d'abord, puis les autres ;
        // l'ordre alphabétique est gardé à l'intérieur de chaque groupe.
        return $rows->sortBy(fn ($r) => $r['bought_from_supplier'] ? 0 : 1)->values()->all();
    }

    /**
     * La recherche de la vente : « 2055516 », « 205/55R16 », une marque, une
     * référence. Même lecture que StockService, par Stock::parseSearchQuery().
     */
    private function applySearch(Builder $query, string $q): void
    {
        $parsed = Stock::parseSearchQuery($q);

        if ($parsed['width'] || $parsed['height'] || $parsed['diameter']) {
            $query->whereHas('tyre', function ($t) use ($parsed) {
                if ($parsed['width']) {
                    $t->where('tire_width', $parsed['width']);
                }
                if ($parsed['height']) {
                    $t->where('tire_height', $parsed['height']);
                }
                if ($parsed['diameter']) {
                    $t->where('tire_diameter', $parsed['diameter']);
                }
            });
        }

        if ($parsed['brand_prefix']) {
            $prefix = $parsed['brand_prefix'];
            $query->whereHas('brand', fn ($b) => $b->where('name', 'like', "{$prefix}%"));
        }

        foreach ($parsed['text'] as $token) {
            $query->where(function ($w) use ($token) {
                $w->where('profile', 'like', "%{$token}%")
                    ->orWhere('reference', 'like', "%{$token}%")
                    ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', "%{$token}%"))
                    ->orWhereHas('part', fn ($p) => $p->where('oem_reference', 'like', "%{$token}%"));
            });
        }
    }

    /**
     * Les lignes d'achat de ces produits, de la plus récente à la plus
     * ancienne, groupées par produit. Les achats annulés ne comptent pas, ni
     * l'achat que l'on est en train de modifier : son prix n'est pas
     * « le dernier connu », c'est celui que l'on saisit.
     *
     * @param  array<int>  $productIds
     * @return Collection<int, Collection<int, object>>
     */
    private function purchaseHistory(array $productIds, ?int $excludePurchaseId): Collection
    {
        return DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->whereIn('purchase_items.product_id', $productIds)
            ->where('purchases.status', '!=', PurchaseStatus::ANNULE->value)
            ->when($excludePurchaseId, fn ($q) => $q->where('purchases.id', '!=', $excludePurchaseId))
            ->orderByDesc('purchases.date')
            ->orderByDesc('purchases.id')
            ->get([
                'purchase_items.product_id',
                'purchase_items.unit_price',
                'purchases.id as purchase_id',
                'purchases.date',
                'purchases.supplier_id',
                'suppliers.name as supplier_name',
            ])
            ->groupBy('product_id');
    }

    /**
     * Le dernier prix de vente facturé de chaque produit, hors ventes annulées.
     *
     * @param  array<int>  $productIds
     * @return Collection<int, float>
     */
    private function lastSalePrices(array $productIds): Collection
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereIn('sale_items.product_id', $productIds)
            ->where('sales.status', '!=', 'ANNULE')
            ->where('sale_items.selling_price', '>', 0)
            ->orderByDesc('sales.date')
            ->orderByDesc('sales.id')
            ->get(['sale_items.product_id', 'sale_items.selling_price'])
            ->groupBy('product_id')
            ->map(fn ($rows) => round((float) $rows->first()->selling_price, 2));
    }

    private function purchaseRow(object $row): array
    {
        return [
            'unit_price' => round((float) $row->unit_price, 2),
            'date' => substr((string) $row->date, 0, 10),
            'purchase_id' => (int) $row->purchase_id,
            'supplier_id' => $row->supplier_id !== null ? (int) $row->supplier_id : null,
            'supplier_name' => $row->supplier_name,
        ];
    }

    /** « 205/55R16 91V » pour un pneu ; rien pour une pièce. */
    private function dimension(Product $product): ?string
    {
        $t = $product->tyre;
        if ($product->type !== 'tyre' || ! $t || ! $t->tire_width || ! $t->tire_diameter) {
            return null;
        }

        $fmt = fn ($v) => rtrim(rtrim(number_format((float) $v, 1, '.', ''), '0'), '.');
        $size = $fmt($t->tire_width).($t->tire_height ? '/'.$fmt($t->tire_height) : '').'R'.$fmt($t->tire_diameter);
        $indices = trim(($t->tire_load_index ?? '').($t->tire_speed_index ?? ''));

        return $indices !== '' ? "{$size} {$indices}" : $size;
    }
}
