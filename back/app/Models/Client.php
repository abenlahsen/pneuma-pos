<?php

namespace App\Models;

use App\Domain\Portal\PortalAccessService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
        'phone',
        'email',
        'city',
        'city_id',
        'address',
        'notes',
        'is_active',
        'credit_limit',
        'discount_rate',
        'opening_balance',
        'payment_terms_days',
        'default_payment_method',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'credit_limit' => 'float',
        // Remise en % sur le prix catalogue (étape 13). Voir ClientPriceResolver.
        'discount_rate' => 'float',
        'opening_balance' => 'float',
        'payment_terms_days' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function cityRelation(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }

    protected function city(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->cityRelation?->name,
            set: function (?string $value) {
                if (! $value) {
                    return ['city_id' => null];
                }
                $city = City::where('name', $value)->first();

                return ['city_id' => $city?->id];
            }
        );
    }

    /**
     * Étape 13.1 — un client archivé (is_active passé à faux) ou supprimé
     * suspend tous ses accès portail et révoque leurs jetons. Le réactiver
     * ne rouvre pas ses accès : l'agence les réactive un par un.
     */
    protected static function booted(): void
    {
        static::updated(function (Client $client) {
            if ($client->wasChanged('is_active') && ! $client->is_active) {
                app(PortalAccessService::class)->suspendAllFor($client);
            }
        });

        static::deleting(function (Client $client) {
            app(PortalAccessService::class)->suspendAllFor($client);
        });
    }

    public function portalAccounts(): HasMany
    {
        return $this->hasMany(ClientPortalAccount::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class)->orderBy('brand');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function serviceOrders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class, 'client_id');
    }

    public function payments(): HasManyThrough
    {
        return $this->hasManyThrough(
            Payment::class,
            Sale::class,
            'client_id',
            'sale_id',
            'id',
            'id'
        );
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeInactive(Builder $query): Builder
    {
        return $query->where('is_active', false);
    }
}
