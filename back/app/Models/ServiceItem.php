<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceItem extends Model
{
    protected $fillable = [
        'service_order_id',
        'item_type',
        'service_type',
        'product_id',
        'quantity',
        'unit_price',
        'purchase_price',
        'stock_id',
        'description',
        'parts_cost',
        'labor_cost',
        'line_total',
        'sort_order',
    ];

    protected $casts = [
        'parts_cost' => 'decimal:2',
        'labor_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'purchase_price' => 'decimal:2',
        'line_total' => 'decimal:2',
        'quantity' => 'integer',
        'sort_order' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (ServiceItem $item) {
            if ($item->item_type === 'part') {
                $item->line_total = (float) ($item->quantity ?? 1) * (float) ($item->unit_price ?? 0);
                $item->parts_cost = 0;
                $item->labor_cost = 0;
            } else {
                $qty = (int) ($item->quantity ?? 1);
                $item->line_total = $qty * ((float) ($item->parts_cost ?? 0) + (float) ($item->labor_cost ?? 0));
            }
        });

        static::saved(fn (ServiceItem $item) => $item->serviceOrder->recalculateTotals());
        static::deleted(fn (ServiceItem $item) => $item->serviceOrder->recalculateTotals());
    }

    public function serviceOrder(): BelongsTo
    {
        return $this->belongsTo(ServiceOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }
}
