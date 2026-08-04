<?php

namespace App\Enums;

enum ShipmentChangeStatus: string
{
    case BROUILLON = 'BROUILLON';
    case ENVOYEE = 'ENVOYEE';
    case ACCEPTEE = 'ACCEPTEE';
    case REFUSEE = 'REFUSEE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
