<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductTyre extends Model
{
    protected $primaryKey = 'product_id';
    public $incrementing = false;

    protected $fillable = [
        'product_id',
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
        'tire_width' => 'integer',
        'tire_height' => 'integer',
        'tire_diameter' => 'integer',
        'tire_runflat' => 'boolean',
        'tire_reinforced' => 'boolean',
        'eu_noise_db' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
