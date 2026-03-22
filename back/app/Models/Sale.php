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
        'date',
        'with_invoice',
        'quantity',
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
        'margin',
        'supplier_id',
        'city',
        'carrier_id',
        'tracking_number',
        'partner_id',
        'service',
        'service_fee',
        'client',
        'payment_method',
        'commercial_id',
        'status',
        'payment_status',
        'delivery_date',
        'comments',
        'user_id',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'with_invoice' => 'boolean',
        'quantity' => 'integer',
        'purchase_price' => 'decimal:2',
        'total_purchase' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'total_sale' => 'decimal:2',
        'margin' => 'decimal:2',
        'service_fee' => 'decimal:2',
        'delivery_date' => 'date:Y-m-d',
    ];

    /**
     * The provider of the products supplied for this sale.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * The sales representative (commercial) for this sale.
     */
    public function commercial(): BelongsTo
    {
        return $this->belongsTo(Personnel::class, 'commercial_id');
    }

    /**
     * The transport carrier for this sale.
     */
    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class);
    }

    /**
     * The service partner for this sale.
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }


    /**
     * The user who recorded the sale.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Payments for this sale.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
