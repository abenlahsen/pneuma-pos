<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceItem extends Model
{
    protected $fillable = [
        'service_order_id',
        'product_id',
        'description',
        'parts_cost',
        'labor_cost',
        'line_total',
        'sort_order',
    ];

    protected $casts = [
        'parts_cost' => 'decimal:2',
        'labor_cost' => 'decimal:2',
        'line_total' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (ServiceItem $item) {
            $item->line_total = (float) ($item->parts_cost ?? 0) + (float) ($item->labor_cost ?? 0);
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
        return $this->belongsTo(Product::class)->with('service');
    }
}
