<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    public const TYPE_AUTO_CREATE = 'AUTO_CREATE';
    public const TYPE_INITIAL = 'INITIAL';
    public const TYPE_IMPORT = 'IMPORT';
    public const TYPE_ADJUSTMENT = 'ADJUSTMENT';
    public const TYPE_DELETION = 'DELETION';
    public const TYPE_SALE_OUT = 'SALE_OUT';
    public const TYPE_SALE_IN = 'SALE_IN';
    public const TYPE_PURCHASE_IN = 'PURCHASE_IN';
    public const TYPE_PURCHASE_OUT = 'PURCHASE_OUT';

    protected $fillable = [
        'stock_id',
        'product_id',
        'type',
        'quantity_before',
        'quantity_after',
        'delta',
        'reference_type',
        'reference_id',
        'reason',
        'user_id',
    ];

    protected $casts = [
        'quantity_before' => 'integer',
        'quantity_after' => 'integer',
        'delta' => 'integer',
        'reference_id' => 'integer',
    ];

    public function stock()
    {
        return $this->belongsTo(Stock::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}