<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use App\Models\ServiceOrder;

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
        'opening_balance',
        'payment_terms_days',
        'default_payment_method',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'credit_limit' => 'float',
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
