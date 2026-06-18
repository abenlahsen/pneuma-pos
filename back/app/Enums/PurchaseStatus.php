<?php

namespace App\Enums;

enum PurchaseStatus: string
{
    case EN_COURS = 'EN COURS';
    case RECU     = 'RECU';
    case TERMINE  = 'TERMINE';
    case ANNULE   = 'ANNULE';
    case RETOUR   = 'RETOUR';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
