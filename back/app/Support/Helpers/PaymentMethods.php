<?php

namespace App\Support\Helpers;

/**
 * Canonical payment-method vocabulary, mirroring the frontend PAYMENT_METHODS
 * constant (front/src/app/core/constants/payment-method.constants.ts).
 *
 * `payments.method` / `purchase_payments.method` are free-form string columns
 * (validated only as string|max:...), so unknown/legacy values are kept
 * (appended last, alphabetically) rather than dropped.
 */
final class PaymentMethods
{
    public const VOCABULARY = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

    /**
     * @param  iterable<int, string|null>  $methods
     * @return array<int, string> distinct, non-empty, canonical order
     */
    public static function distinct(iterable $methods): array
    {
        $known = [];
        $unknown = [];

        foreach ($methods as $method) {
            $method = is_string($method) ? trim($method) : '';

            if ($method === '') {
                continue;
            }

            $rank = array_search($method, self::VOCABULARY, true);

            if ($rank !== false) {
                $known[$rank] = $method;
            } else {
                $unknown[$method] = $method;
            }
        }

        ksort($known);
        ksort($unknown);

        return array_merge(array_values($known), array_values($unknown));
    }
}
