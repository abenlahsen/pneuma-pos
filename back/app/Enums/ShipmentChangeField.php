<?php

namespace App\Enums;

enum ShipmentChangeField: string
{
    case PAYMENT_METHOD = 'payment_method';
    case RECIPIENT_NAME = 'recipient_name';
    case RECIPIENT_PHONE = 'recipient_phone';
    case ADDRESS = 'address';
    case CITY = 'city';
    case AMOUNT = 'amount';
    case OTHER = 'other';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::PAYMENT_METHOD => 'Mode de paiement',
            self::RECIPIENT_NAME => 'Nom du destinataire',
            self::RECIPIENT_PHONE => 'Téléphone du destinataire',
            self::ADDRESS => 'Adresse de livraison',
            self::CITY => 'Ville de destination',
            self::AMOUNT => 'Montant à encaisser',
            self::OTHER => 'Autre',
        };
    }
}
