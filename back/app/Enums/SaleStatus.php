<?php

namespace App\Enums;

enum SaleStatus: string
{
    case EN_COURS = 'EN COURS';
    case LIVRE    = 'LIVRE';
    case MONTE    = 'MONTE';
    case TERMINEE = 'TERMINEE';
    case ANNULE   = 'ANNULE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
