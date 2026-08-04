<?php

namespace App\Enums;

enum PurchaseStatus: string
{
    case EN_COURS = 'EN COURS';
    case RECU = 'RECU';
    case TERMINE = 'TERMINE';
    case ANNULE = 'ANNULE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Allowed next statuses from each status — one step forward or one step
     * back, never a direct jump from EN COURS to TERMINE. ANNULE is a dead
     * end: it can only be reactivated back to EN COURS, never advanced to
     * TERMINE.
     *
     * @return array<string, array<string>>
     */
    public static function allowedTransitions(): array
    {
        return [
            self::EN_COURS->value => [self::RECU->value, self::ANNULE->value],
            self::RECU->value => [self::EN_COURS->value, self::TERMINE->value],
            self::TERMINE->value => [self::RECU->value],
            self::ANNULE->value => [self::EN_COURS->value],
        ];
    }
}
