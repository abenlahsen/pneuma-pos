<?php

namespace App\Enums;

enum ServiceOrderStatus: string
{
    case EN_COURS = 'EN COURS';
    case TERMINE  = 'TERMINE';
    case ANNULE   = 'ANNULE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
