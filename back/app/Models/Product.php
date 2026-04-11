<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Product extends Model
{
    protected $fillable = [
        'profile',
        'reference',
        'type',
        'brand_id',
        'description',
        'unit',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class);
    }

    public function tyre(): HasOne
    {
        return $this->hasOne(ProductTyre::class);
    }

    public function part(): HasOne
    {
        return $this->hasOne(ProductPart::class);
    }

    public function service(): HasOne
    {
        return $this->hasOne(ProductService::class);
    }

    /**
     * Return the sub-model matching this product's type.
     */
    public function details(): ?Model
    {
        return match ($this->type) {
            'tyre' => $this->tyre,
            'part' => $this->part,
            'service' => $this->service,
            default => null,
        };
    }
}
