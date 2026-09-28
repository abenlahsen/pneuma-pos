<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Un accès au portail client (étape 13.1).
 *
 * Ce n'est pas un User : il s'authentifie par la garde `portal`, sur
 * `/api/portal/*`, avec ses propres jetons. La garde `sanctum` de l'agence
 * n'accepte que des User, la garde `portal` que des ClientPortalAccount
 * (config/auth.php) : un jeton n'ouvre jamais les routes de l'autre public.
 *
 * Tout ce que le portail montre se résout depuis `client_id` de ce compte,
 * jamais depuis un paramètre de la requête.
 */
class ClientPortalAccount extends Authenticatable
{
    use HasApiTokens, Notifiable;

    public const STATUS_INVITED = 'INVITE';

    public const STATUS_ACTIVE = 'ACTIF';

    public const STATUS_SUSPENDED = 'SUSPENDU';

    protected $fillable = [
        'client_id',
        'name',
        'email',
        'status',
        'invited_at',
        'invited_by',
    ];

    protected $hidden = [
        'password',
        'activation_token_hash',
        'reset_token_hash',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'activation_expires_at' => 'datetime',
        'reset_expires_at' => 'datetime',
        'invited_at' => 'datetime',
        'activated_at' => 'datetime',
        'last_login_at' => 'datetime',
        'suspended_at' => 'datetime',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** Un compte ne peut servir que si lui et son client sont actifs. */
    public function canUsePortal(): bool
    {
        return $this->isActive()
            && $this->client !== null
            && (bool) $this->client->is_active;
    }
}
