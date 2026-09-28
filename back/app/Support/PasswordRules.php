<?php

namespace App\Support;

/**
 * Les règles d'un nouveau mot de passe, communes à l'équipe
 * (change-password) et au portail client (activation, réinitialisation).
 */
final class PasswordRules
{
    /**
     * @return array<int, string>
     */
    public static function newPassword(): array
    {
        return ['required', 'string', 'min:8', 'confirmed'];
    }
}
