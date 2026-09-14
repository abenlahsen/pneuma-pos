<?php

namespace App\Enums;

enum QuoteStatus: string
{
    case ENVOYE = 'ENVOYE';
    case ACCEPTE = 'ACCEPTE';
    case REFUSE = 'REFUSE';
    case ANNULE = 'ANNULE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
