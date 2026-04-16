<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPart extends Model
{
    protected $primaryKey = 'product_id';
    public $incrementing = false;

    protected $fillable = [
        'product_id',
        'category',
        'oem_reference',
        'compatibility',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}