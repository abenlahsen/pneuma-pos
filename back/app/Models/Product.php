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

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function stocks()
    {
        return $this->hasMany(Stock::class);
    }

    public function tyre()
    {
        return $this->hasOne(ProductTyre::class);
    }

    public function part()
    {
        return $this->hasOne(ProductPart::class);
    }

    public function service()
    {
        return $this->hasOne(ProductService::class);
    }

    /**
     * Return the sub-model matching this product's type.
     */
    public function details()
    {
        switch ($this->type) {
            case 'tyre':
                return $this->tyre;
            case 'part':
                return $this->part;
            case 'service':
                return $this->service;
            default:
                return null;
        }
    }
}