<?php

namespace App\Enums;

enum ServiceOrderPaymentStatus: string
{
    case NON_PAYE = 'NON PAYE';
    case PAYE     = 'PAYE';
    case PARTIEL  = 'PARTIEL';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
