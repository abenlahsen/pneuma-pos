<?php

namespace App\Domain\Support;

use Illuminate\Validation\ValidationException;

/**
 * Enforces a status workflow's allowed-transitions map (as produced by
 * SaleStatus::allowedTransitions() / PurchaseStatus::allowedTransitions()):
 * one step forward or one step back only — never a direct jump across the
 * workflow. Shared by SaleService and PurchaseService, which previously
 * duplicated near-identical logic.
 */
class StatusTransitionGuard
{
    /**
     * @param  array<string, array<string>>  $transitions
     *
     * @throws ValidationException
     */
    public static function assert(string $from, string $to, array $transitions, bool $bypass, string $entityLabel): void
    {
        if ($bypass || $from === $to) {
            return;
        }

        if (! in_array($to, $transitions[$from] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => ["Impossible de passer directement de « {$from} » à « {$to} » pour {$entityLabel}."],
            ]);
        }
    }
}
