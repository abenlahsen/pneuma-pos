<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Les filtres à choix multiple des listes Ventes, Achats et Service Auto :
 * Statut, Paiement, Mode de paiement.
 *
 * Le front coche plusieurs valeurs et les envoie jointes par des virgules
 * (`status=LIVRE,MONTE`, `payment_method=Chèque,Effet`) — aucune valeur
 * autorisée ne contient de virgule, et une valeur seule (`status=LIVRE`)
 * garde son sens d'avant. Un tableau (`status[]=…`) est aussi accepté.
 *
 * Une valeur hors vocabulaire est refusée (422) plutôt que de rendre une
 * liste vide sans rien dire.
 */
final class MultiValueFilter
{
    /**
     * @param  array<int, string>  $allowed
     * @param  string  $field  le paramètre de la requête, pour l'erreur 422
     * @param  string  $label  son nom lisible : « Statut inconnu : X. »
     * @return array<int, string> les valeurs demandées ; vide = pas de filtre
     */
    public static function parse(mixed $raw, array $allowed, string $field = 'status', string $label = 'Statut'): array
    {
        $values = is_array($raw) ? $raw : explode(',', (string) $raw);

        $selected = collect($values)
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn (string $value) => $value !== '')
            ->unique()
            ->values();

        $unknown = $selected->diff($allowed);
        if ($unknown->isNotEmpty()) {
            throw ValidationException::withMessages([
                $field => $label.' inconnu : '.$unknown->implode(', ').'.',
            ]);
        }

        return $selected->all();
    }

    /** @param  array<int, string>  $values */
    public static function apply(Builder $query, array $values, string $column = 'status'): void
    {
        if ($values !== []) {
            $query->whereIn($column, $values);
        }
    }
}
