<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReturnItem extends Model
{
    protected $fillable = [
        'purchase_return_id',
        'purchase_item_id',
        'product_id',
        'stock_id',
        'quantity',
        'unit_price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
    ];

    protected $appends = ['total_price'];

    public function getTotalPriceAttribute()
    {
        return round($this->quantity * $this->unit_price, 2);
    }

    public function return(): BelongsTo
    {
        return $this->belongsTo(PurchaseReturn::class, 'purchase_return_id');
    }

    public function purchaseItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseItem::class);
    }

    public function linkedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }
}
