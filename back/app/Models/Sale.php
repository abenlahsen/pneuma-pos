<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasFactory;

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
        'city',
        'transport',
        'partner',
        'service',
        'service_fee',
        'client_id',
        'payment_method',
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
        'commercial_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

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

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function saleItems(): HasMany
    {
        return $this->items();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
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
        return (float) $this->payments->sum(function (Payment $payment) {
            return $payment->amount ?? $payment->amount_paid ?? 0;
        });
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
