<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $fillable = [
        'client_id', 'plate', 'brand', 'model_name',
        'circulation_month', 'circulation_year',
        'vin', 'notes', 'is_active',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'circulation_month' => 'integer',
        'circulation_year'  => 'integer',
        'is_active'         => 'boolean',
    ];

    public function getDisplayNameAttribute(): string
    {
        $date = sprintf('%02d/%d', $this->circulation_month, $this->circulation_year);

        return "{$this->brand} {$this->model_name} — {$this->plate} ({$date})";
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function serviceOrders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
