<?php

namespace App\Domain\Portal;

use App\Domain\Pricing\ClientPriceResolver;
use App\Models\Client;
use App\Models\Product;
use App\Models\Stock;
use Illuminate\Database\Eloquent\Builder;

/**
 * Le catalogue du portail (étape 13.2), pour un client donné.
 *
 * Seuls les pneus actifs ayant un prix catalogue y figurent. Chaque ligne
 * porte le prix du client (ClientPriceResolver) et un niveau de
 * disponibilité (PortalAvailability). La réponse est construite champ par
 * champ : jamais de prix d'achat, de marge, de quantité, de dépôt, de lot,
 * de DOT ni de fournisseur.
 */
class PortalCatalog
{
    public const MAX_PER_PAGE = 50;

    public function __construct(
        private ClientPriceResolver $prices,
        private PortalAvailability $availability,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  q, brand_id, season, load_index, available_only, page, per_page
     * @return array<string, mixed>
     */
    public function search(Client $client, array $filters): array
    {
        $query = Product::query()
            ->with(['brand:id,name', 'tyre'])
            ->where('type', 'tyre')
            ->where('is_active', true)
            ->whereNotNull('catalog_price');

        $this->applySearch($query, (string) ($filters['q'] ?? ''));

        if (! empty($filters['brand_id'])) {
            $query->where('brand_id', (int) $filters['brand_id']);
        }
        if (! empty($filters['season'])) {
            $query->whereHas('tyre', fn ($q) => $q->where('tire_season', $filters['season']));
        }
        if (! empty($filters['load_index'])) {
            $query->whereHas('tyre', fn ($q) => $q->where('tire_load_index', $filters['load_index']));
        }

        $products = $query->orderBy('id')->get();
        $levels = $this->availability->forProducts($products->pluck('id')->all());

        if (! empty($filters['available_only'])) {
            $products = $products->filter(fn (Product $p) => in_array($levels[$p->id]['level'], [PortalAvailability::AVAILABLE, PortalAvailability::LIMITED], true));
        }

        // Disponible d'abord, puis par marque et profil.
        $rank = [PortalAvailability::AVAILABLE => 0, PortalAvailability::LIMITED => 1, PortalAvailability::WITHIN_24H => 2, PortalAvailability::ON_ORDER => 3];
        $products = $products->sortBy([
            fn (Product $a, Product $b) => $rank[$levels[$a->id]['level']] <=> $rank[$levels[$b->id]['level']],
            fn (Product $a, Product $b) => strcmp((string) $a->brand?->name.' '.$a->profile, (string) $b->brand?->name.' '.$b->profile),
        ])->values();

        $perPage = max(1, min(self::MAX_PER_PAGE, (int) ($filters['per_page'] ?? 25)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $total = $products->count();

        $discount = $this->prices->discountRate($client);
        $rows = $products->forPage($page, $perPage)->map(fn (Product $product) => [
            'id' => $product->id,
            'designation' => trim(($product->brand?->name ?? '').' '.($product->profile ?? '')) ?: (string) $product->reference,
            'brand' => $product->brand?->name,
            'profile' => $product->profile,
            'reference' => $product->reference,
            'dimension' => $this->dimension($product),
            'load_index' => $product->tyre?->tire_load_index,
            'speed_index' => $product->tyre?->tire_speed_index,
            'season' => $product->tyre?->tire_season,
            'runflat' => (bool) ($product->tyre?->tire_runflat ?? false),
            'reinforced' => (bool) ($product->tyre?->tire_reinforced ?? false),
            'catalog_price' => round((float) $product->catalog_price, 2),
            'discount_rate' => $discount,
            'price' => $this->prices->priceFor($client, $product),
            'availability' => $levels[$product->id],
        ])->values()->all();

        return [
            'data' => $rows,
            'meta' => [
                'total' => $total,
                'current_page' => $page,
                'per_page' => $perPage,
                'last_page' => max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    /**
     * Recherche tolérante : 2055516, 205/55R16, 205 55 16, une marque, un
     * profil, une référence. « 205 55 16 » est ramené à « 205/55R16 » avant
     * l'analyse partagée de l'étape 5a, qui lirait sinon 55 comme une jante.
     */
    private function applySearch(Builder $query, string $q): void
    {
        $q = trim($q);
        if ($q === '') {
            return;
        }

        $q = preg_replace('/^(\d{3})[\s\/-]+(\d{2})[\s\/-]*(?:[zZ]?[rR])?\s*(\d{2}(?:\.\d)?)(\s|$)/', '$1/$2R$3$4', $q) ?? $q;
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

        if (! empty($parsed['brand_prefix'])) {
            $prefix = $parsed['brand_prefix'];
            $query->whereHas('brand', fn ($b) => $b->where('name', 'like', $prefix.'%'));
        }

        foreach ($parsed['text'] as $word) {
            $query->where(function ($w) use ($word) {
                $like = '%'.$word.'%';
                $w->where('profile', 'like', $like)
                    ->orWhere('reference', 'like', $like)
                    ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', $like));
            });
        }
    }

    private function dimension(Product $product): ?string
    {
        $t = $product->tyre;
        if (! $t || ! $t->tire_width || ! $t->tire_diameter) {
            return null;
        }

        // Colonnes castées en float : (string) 205.0 donne « 205 », 17.5 « 17.5 ».
        $height = $t->tire_height ? '/'.(float) $t->tire_height : '';

        return (float) $t->tire_width.$height.'R'.(float) $t->tire_diameter;
    }
}
