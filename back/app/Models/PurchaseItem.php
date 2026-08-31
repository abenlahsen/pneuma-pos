<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_id',
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

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function linkedProduct()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function stock()
    {
        return $this->belongsTo(Stock::class);
    }

    public function returns()
    {
        return $this->hasMany(PurchaseReturnItem::class);
    }

    /**
     * Quantity of this line already sent back to the supplier across every
     * recorded PurchaseReturn.
     */
    public function returnedQuantity(): int
    {
        return (int) $this->returns()->sum('quantity');
    }

    /**
     * Quantity of this line still held — the ceiling for a new return and
     * the amount PurchaseService restores/reapplies on status changes, so a
     * partially-returned line is never double-counted.
     */
    public function remainingQuantity(): int
    {
        return max(0, (int) $this->quantity - $this->returnedQuantity());
    }
}
