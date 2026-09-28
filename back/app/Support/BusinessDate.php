<?php

namespace App\Support;

/**
 * La date du jour du magasin, à l'heure du Maroc.
 *
 * L'application tourne en UTC (config('app.timezone')) : ses horodatages
 * restent en UTC. Mais « aujourd'hui », pour une date saisie par l'équipe
 * — une réception, par exemple — est le jour au Maroc : entre minuit et 1 h
 * quand le Maroc est à UTC+1, UTC est encore la veille.
 *
 * Le serveur fait référence : ses règles de fuseau (tzdata) sont plus à jour
 * que celles des navigateurs, qui peuvent se tromper d'une heure sur le Maroc.
 * Le front lit cette date par GET /api/business-date plutôt que de la calculer.
 */
final class BusinessDate
{
    public static function timezone(): string
    {
        return (string) config('app.business_timezone', 'Africa/Casablanca');
    }

    /** Le jour au Maroc, au format Y-m-d. */
    public static function today(): string
    {
        return now(self::timezone())->toDateString();
    }
}
