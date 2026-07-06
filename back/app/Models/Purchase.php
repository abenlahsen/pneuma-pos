<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'with_invoice',
        'bl_number',
        'invoice_number',
        'total_quantity',
        'total_price',
        'discount',
        'net_amount',
        'supplier_id',
        'commercial_id',
        'status',
        'payment_status',
        'payment_method',
        'payment_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
        'payment_date' => 'date',
        'with_invoice' => 'boolean',
        'total_quantity' => 'integer',
        'total_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'net_amount' => 'decimal:2',
    ];

    // Removed appended total_price because it is now a real DB column.

    public function items()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function commercial()
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Legacy relation — only returns payments created against this purchase alone
     * (purchase_id set directly). Multi-purchase supplier payments do not set
     * purchase_id; use `allocations()` for the authoritative paid-amount source.
     */
    public function payments()
    {
        return $this->hasMany(PurchasePayment::class);
    }

    public function allocations()
    {
        return $this->hasMany(PurchasePaymentAllocation::class);
    }

    public function paidAmount(): float
    {
        return (float) $this->allocations()->sum('amount');
    }
}
