<?php

namespace App\Support\Helpers;

use App\Models\Product;

/**
 * Builds the "Marque Profil — DIMENSION · IC IV Marquage" designation used on
 * the printed bon d'achat/bon de vente, Excel exports, and purchase-return
 * stock-shortage messages — one source of truth so all three surfaces show
 * the same label. Extracted from PurchaseController::formatProductLabel(),
 * which previously duplicated this per-controller.
 */
final class ProductLabel
{
    public static function format(?Product $product, string $fallback): string
    {
        if (! $product) {
            return $fallback;
        }

        if ($product->type !== 'tyre') {
            return $product->reference ?: $fallback;
        }

        $labelParts = array_filter([$product->brand?->name, $product->profile]);
        $label = implode(' ', $labelParts) ?: ($product->reference ?: $fallback);

        $tyre = $product->tyre;
        $reference = null;
        if ($tyre?->tire_width && $tyre?->tire_height && $tyre?->tire_diameter) {
            $reference = $tyre->tire_width.'/'.$tyre->tire_height.'R'.$tyre->tire_diameter;
        }

        $detailParts = array_filter([$tyre?->tire_load_index, $tyre?->tire_speed_index, $tyre?->tire_marking]);
        $details = implode(' · ', $detailParts);

        $result = $label;
        if ($reference) {
            $result .= ' — '.$reference;
        }
        if ($details) {
            $result .= ' · '.$details;
        }

        return $result;
    }
}
