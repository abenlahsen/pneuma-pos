<?php

namespace App\Enums;

enum SaleStatus: string
{
    /**
     * Saisie interrompue et gardee (`2b`). Au comptoir une vente s'arrete
     * souvent — le client va chercher sa carte, le technicien verifie une
     * dimension — et « Annuler » jetait la saisie.
     *
     * Un brouillon ne sort RIEN du stock : la marchandise peut encore etre
     * vendue a quelqu'un d'autre. Voir `statusAppliesStock()`.
     */
    case BROUILLON = 'BROUILLON';

    case EN_COURS = 'EN COURS';
    case LIVRE = 'LIVRE';
    case MONTE = 'MONTE';
    case TERMINEE = 'TERMINEE';
    case ANNULE = 'ANNULE';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Allowed next statuses from each status — one step forward or one step
     * back, never a direct jump from EN COURS to TERMINEE. LIVRE and MONTE
     * are two equivalent outcomes of the same middle step, interchangeable
     * without going back through EN COURS. ANNULE is a dead end: it can
     * only be reactivated back to EN COURS, never advanced to TERMINEE.
     *
     * @return array<string, array<string>>
     */
    public static function allowedTransitions(): array
    {
        return [
            // Un brouillon ne va que vers une vente reelle, ou disparait.
            self::BROUILLON->value => [self::EN_COURS->value, self::ANNULE->value],
            self::EN_COURS->value => [self::LIVRE->value, self::MONTE->value, self::ANNULE->value],
            self::LIVRE->value => [self::EN_COURS->value, self::MONTE->value, self::TERMINEE->value],
            self::MONTE->value => [self::EN_COURS->value, self::LIVRE->value, self::TERMINEE->value],
            self::TERMINEE->value => [self::LIVRE->value, self::MONTE->value],
            self::ANNULE->value => [self::EN_COURS->value],
        ];
    }
}
