<?php

namespace App\Domain\Portal;

use App\Models\CompanySetting;
use Illuminate\Support\Facades\DB;

/**
 * Le niveau de disponibilité d'un produit sur le portail (étape 13.2).
 *
 * Le client ne voit jamais une quantité : un niveau, calculé ici.
 *   - stock disponible ≥ seuil (Paramètres, 8 par défaut)  → Disponible
 *   - 1 à seuil − 1                                         → Stock limité
 *   - 0, avec un achat attendu                              → Sous 24 h
 *   - 0, sans achat attendu                                 → Sur commande · N j
 *
 * Le stock disponible est la somme des lots positifs : les quantités
 * attendues (achats « En cours » pas encore réceptionnés, étape 12) n'y sont
 * pas. Les achats n'ont pas de date de livraison prévue : un achat attendu
 * donne « Sous 24 h ». Le délai « sur commande » est celui du fournisseur
 * du dernier achat du produit ; sans achat connu, 7 jours.
 */
class PortalAvailability
{
    public const AVAILABLE = 'available';

    public const LIMITED = 'limited';

    public const WITHIN_24H = 'within_24h';

    public const ON_ORDER = 'on_order';

    public const DEFAULT_LEAD_DAYS = 7;

    /**
     * @param  array<int, int>  $productIds
     * @return array<int, array{level: string, label: string, lead_days: int|null}>
     */
    public function forProducts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $threshold = max(1, (int) (CompanySetting::query()->value('portal_available_threshold') ?? 8));

        $available = DB::table('stocks')
            ->whereIn('product_id', $productIds)
            ->where('quantity', '>', 0)
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(quantity) as qty')
            ->pluck('qty', 'product_id');

        $expected = DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereIn('purchase_items.product_id', $productIds)
            ->where('purchases.status', 'EN COURS')
            ->where('purchases.stock_applied', false)
            ->groupBy('purchase_items.product_id')
            ->selectRaw('purchase_items.product_id, SUM(purchase_items.quantity) as qty')
            ->pluck('qty', 'purchase_items.product_id');

        $leadDays = $this->supplierLeadDays($productIds);

        $levels = [];
        foreach ($productIds as $id) {
            $qty = (int) ($available[$id] ?? 0);
            $levels[$id] = match (true) {
                $qty >= $threshold => ['level' => self::AVAILABLE, 'label' => 'Disponible', 'lead_days' => null],
                $qty > 0 => ['level' => self::LIMITED, 'label' => 'Stock limité', 'lead_days' => null],
                (int) ($expected[$id] ?? 0) > 0 => ['level' => self::WITHIN_24H, 'label' => 'Sous 24 h', 'lead_days' => 1],
                default => ['level' => self::ON_ORDER, 'label' => 'Sur commande · '.($leadDays[$id] ?? self::DEFAULT_LEAD_DAYS).' j', 'lead_days' => $leadDays[$id] ?? self::DEFAULT_LEAD_DAYS],
            };
        }

        return $levels;
    }

    /**
     * Le délai du fournisseur du dernier achat (non annulé) de chaque produit.
     *
     * @param  array<int, int>  $productIds
     * @return array<int, int>
     */
    private function supplierLeadDays(array $productIds): array
    {
        $lastPurchase = DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereIn('purchase_items.product_id', $productIds)
            ->where('purchases.status', '!=', 'ANNULE')
            ->groupBy('purchase_items.product_id')
            ->selectRaw('purchase_items.product_id, MAX(purchases.id) as purchase_id');

        return DB::table('purchases')
            ->joinSub($lastPurchase, 'last', fn ($join) => $join->on('purchases.id', '=', 'last.purchase_id'))
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->pluck('suppliers.delivery_lead_days', 'last.product_id')
            ->map(fn ($days) => (int) $days)
            ->all();
    }
}
