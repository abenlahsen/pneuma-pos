<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceOrder extends Model
{
    protected $fillable = [
        'client_id',
        'vehicle_id',
        'date',
        'vehicle',
        'mileage',
        'total_amount',
        'total_purchase',
        'margin',
        'discount',
        'net_amount',
        'status',
        'payment_status',
        'notes',
        'commercial_id',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
        'total_amount' => 'decimal:2',
        'total_purchase' => 'decimal:2',
        'margin' => 'decimal:2',
        'discount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'mileage' => 'integer',
    ];

    public function recalculateTotals(): void
    {
        $items = $this->items()->get(['line_total', 'purchase_price', 'quantity']);
        $total = $items->sum('line_total');
        $totalPurchase = $items->sum(fn ($item) => (float) $item->purchase_price * (int) $item->quantity);
        $discountAmount = $total * ((float) ($this->discount ?? 0) / 100);
        $this->updateQuietly([
            'total_amount' => round($total, 2),
            'total_purchase' => round($totalPurchase, 2),
            'margin' => round($total - $totalPurchase, 2),
            'net_amount' => max(0, round($total - $discountAmount, 2)),
        ]);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ServiceItem::class)->orderBy('sort_order');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function clientRecord(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ServicePayment::class);
    }
}
