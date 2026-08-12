<?php

namespace App\Models;

use App\Models\Concerns\AggregatesPaymentMethods;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use AggregatesPaymentMethods, HasFactory;

    protected $fillable = [
        'reference',
        'date',
        'sale_date',
        'with_invoice',
        'quantity',
        'total_quantity',
        'dimension',
        'ic',
        'iv',
        'rft',
        'brand',
        'profile',
        'purchase_price',
        'total_purchase',
        'selling_price',
        'total_sale',
        'subtotal',
        'discount',
        'tax',
        'margin',
        'carrier_id',
        'tracking_number',
        'partner_id',
        'service',
        'service_fee',
        'client_id',
        'vehicle_id',
        'mileage',
        'sales_rep',
        'commercial_id',
        'status',
        'payment_status',
        'delivery_date',
        'comments',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
        'sale_date' => 'datetime',
        'with_invoice' => 'boolean',
        'quantity' => 'integer',
        'total_quantity' => 'integer',
        'purchase_price' => 'float',
        'total_purchase' => 'float',
        'selling_price' => 'float',
        'total_sale' => 'float',
        'subtotal' => 'float',
        'discount' => 'float',
        'tax' => 'float',
        'margin' => 'float',
        'service_fee' => 'float',
        'delivery_date' => 'date',
        'client_id' => 'integer',
        'vehicle_id' => 'integer',
        'mileage' => 'integer',
        'commercial_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function linkedVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function linkedClient(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function clientRelation(): BelongsTo
    {
        return $this->linkedClient();
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

    public function linkedCarrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class, 'carrier_id');
    }

    public function linkedPartner(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'partner_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function saleItems(): HasMany
    {
        return $this->items();
    }

    /**
     * Legacy relation — only returns payments created against this sale alone
     * (sale_id set directly). Multi-sale client payments do not set sale_id;
     * use `allocations()` for the authoritative paid-amount source.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(SalePaymentAllocation::class);
    }

    public function shipmentChangeRequests(): HasMany
    {
        return $this->hasMany(ShipmentChangeRequest::class);
    }

    public function getSaleDateAttribute()
    {
        return $this->attributes['sale_date'] ?? $this->date;
    }

    public function getClientAttribute($value): ?string
    {
        if ($value !== null && $value !== '') {
            return $value;
        }

        $linkedClient = $this->relationLoaded('linkedClient')
            ? $this->getRelation('linkedClient')
            : ($this->client_id ? $this->linkedClient : null);

        return $linkedClient?->name;
    }

    public function getClientPhoneAttribute($value): ?string
    {
        if ($value !== null && $value !== '') {
            return $value;
        }

        $linkedClient = $this->relationLoaded('linkedClient')
            ? $this->getRelation('linkedClient')
            : ($this->client_id ? $this->linkedClient : null);

        return $linkedClient?->phone;
    }

    public function getTotalAttribute(): float
    {
        return (float) ($this->total_sale ?? 0);
    }

    public function getPaidAmountAttribute(): float
    {
        return (float) $this->allocations()->sum('amount');
    }

    public function getSubtotalAttribute($value): float
    {
        return (float) ($value ?? $this->total_sale ?? 0);
    }

    public function getNotesAttribute(): ?string
    {
        return $this->attributes['notes'] ?? $this->comments;
    }

    public function getOutstandingAmountAttribute(): float
    {
        return round(max(($this->total ?? 0) - ($this->paid_amount ?? 0), 0), 2);
    }
}
