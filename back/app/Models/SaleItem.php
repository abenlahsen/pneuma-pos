<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'stock_id',
        'product_id',
        'quantity',
        'purchase_price',
        'selling_price',
        'discount',
        'total_purchase',
        'total_sale',
        'margin',
    ];

    protected $casts = [
        'sale_id' => 'integer',
        'stock_id' => 'integer',
        'product_id' => 'integer',
        'quantity' => 'integer',
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'total_purchase' => 'decimal:2',
        'total_sale' => 'decimal:2',
        'margin' => 'decimal:2',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }

    public function linkedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}