<?php

namespace App\Domain\Sales;

use App\Models\Product;

/**
 * The fixed catalog of tyre-sale prestations (Montage + Équilibrage,
 * Parallélisme Tourisme / SUV-4x4) offered alongside every tyre sale.
 *
 * Each prestation is backed by a real `products` row (type='service'),
 * identified by a stable reference. The seller decides the actual selling
 * price per sale (usually pre-filled from the chosen partner's rates) — the
 * `default_price` here is only the catalog fallback used when seeding.
 */
class PrestationCatalog
{
    /**
     * @var array<string, array{reference: string, label: string, default_price: float}>
     */
    private const ENTRIES = [
        'montage' => [
            'reference' => 'SVC-MONTAGE-EQ',
            'label' => 'Montage + Équilibrage',
            'default_price' => 30.0,
        ],
        'alignment_vt' => [
            'reference' => 'SVC-PARAL-VT',
            'label' => 'Parallélisme — Tourisme',
            'default_price' => 100.0,
        ],
        'alignment_suv' => [
            'reference' => 'SVC-PARAL-SUV',
            'label' => 'Parallélisme — SUV / 4x4',
            'default_price' => 150.0,
        ],
    ];

    /**
     * @return array<string, array{reference: string, label: string, default_price: float}>
     */
    public static function entries(): array
    {
        return self::ENTRIES;
    }

    /**
     * Resolve the catalog products for each prestation key. A prestation
     * whose product hasn't been seeded yet resolves to null instead of
     * throwing, so callers (the sale form) can degrade gracefully.
     *
     * @return array<string, array{product_id:int,label:string,default_price:float}|null>
     */
    public function resolve(): array
    {
        $references = array_column(self::ENTRIES, 'reference');

        $products = Product::query()
            ->whereIn('reference', $references)
            ->orderBy('id')
            ->get()
            ->unique('reference')
            ->keyBy('reference');

        $result = [];

        foreach (self::ENTRIES as $key => $entry) {
            $product = $products->get($entry['reference']);

            $result[$key] = $product ? [
                'product_id' => $product->id,
                'label' => $entry['label'],
                'default_price' => $entry['default_price'],
            ] : null;
        }

        return $result;
    }
}
