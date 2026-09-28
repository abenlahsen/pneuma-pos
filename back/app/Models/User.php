<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'phone', 'commission_rate', 'prime_per_tyre', 'must_change_password', 'salary', 'cnss_number', 'hire_date'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * Les rôles et permissions de l'équipe sont sur la garde `web`. Depuis que
     * la garde `sanctum` déclare le fournisseur `users` (étape 13.1, pour
     * qu'un jeton du portail n'ouvre pas /api/*), Spatie verrait deux gardes
     * possibles et choisirait celle de la requête (`sanctum`), où aucune
     * permission n'existe. On la fixe.
     */
    protected string $guard_name = 'web';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts()
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'salary' => 'decimal:2',
            'hire_date' => 'date:Y-m-d',
        ];
    }
}
