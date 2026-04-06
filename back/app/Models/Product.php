<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'tire_width',
        'tire_height',
        'tire_diameter',
        'tire_load_index',
        'tire_speed_index',
        'tire_season',
        'tire_runflat',
        'tire_reinforced',
        'tire_marking',
        'eu_fuel',
        'eu_wet_grip',
        'eu_noise_db',
        'eu_noise_class',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'tire_runflat' => 'boolean',
        'tire_reinforced' => 'boolean',
        'tire_width' => 'integer',
        'tire_height' => 'integer',
        'tire_diameter' => 'integer',
        'eu_noise_db' => 'integer',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class);
    }
}
