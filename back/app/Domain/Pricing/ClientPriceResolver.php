<?php

namespace App\Domain\Pricing;

use App\Models\Client;
use App\Models\Product;

/**
 * Le prix d'un produit pour un client : un seul endroit où il se calcule.
 *
 * Aujourd'hui : prix catalogue du produit moins la remise en pourcentage du
 * client. Sans prix catalogue, il n'y a pas de prix — et le produit n'est pas
 * proposé sur le portail.
 *
 * La place d'un tarif négocié par client et par produit est gardée :
 * `negotiatedPrice()` le renverra quand il existera, et il primera sur la
 * remise. Il n'est pas construit (décision étape 13).
 */
class ClientPriceResolver
{
    /** Le prix HT unitaire du produit pour ce client, ou null sans prix catalogue. */
    public function priceFor(Client $client, Product $product): ?float
    {
        $negotiated = $this->negotiatedPrice($client, $product);
        if ($negotiated !== null) {
            return $negotiated;
        }

        if ($product->catalog_price === null) {
            return null;
        }

        return self::applyDiscount((float) $product->catalog_price, $this->discountRate($client));
    }

    /** La remise en pourcentage appliquée à ce client, bornée entre 0 et 100. */
    public function discountRate(Client $client): float
    {
        return max(0.0, min(100.0, (float) ($client->discount_rate ?? 0)));
    }

    public static function applyDiscount(float $catalogPrice, float $rate): float
    {
        return round($catalogPrice * (1 - $rate / 100), 2);
    }

    /**
     * Le tarif négocié pour ce client et ce produit. Aucun n'existe encore :
     * c'est ici qu'une table de tarifs se branchera.
     */
    protected function negotiatedPrice(Client $client, Product $product): ?float
    {
        return null;
    }
}
