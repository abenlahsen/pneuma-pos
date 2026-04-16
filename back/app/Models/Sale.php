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
        'total_quantity',
        'total_purchase',
        'total_sale',
        'margin',

        'city',
        'carrier_id',
        'tracking_number',
        'partner_id',
        'service',
        'service_fee',
        'client',
        'client_phone',
        'payment_method',
        'commercial_id',
        'status',
        'payment_status',
        'delivery_date',
        'comments',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'with_invoice' => 'boolean',
        'total_quantity' => 'integer',
        'total_purchase' => 'decimal:2',
        'total_sale' => 'decimal:2',
        'margin' => 'decimal:2',
        'service_fee' => 'decimal:2',
        'delivery_date' => 'date:Y-m-d',
    ];

    /**
     * The items for this sale.
     */
    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    /**
     * The sales representative (commercial) for this sale.
     */
    public function commercial()
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }

    /**
     * The transport carrier for this sale.
     */
    public function carrier()
    {
        return $this->belongsTo(Carrier::class);
    }

    /**
     * The service partner for this sale.
     */
    public function partner()
    {
        return $this->belongsTo(Partner::class);
    }


    /**
     * The user who created the sale.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The user who last updated the sale.
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Payments for this sale.
     */
    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}