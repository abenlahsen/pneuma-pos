<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchasePayment extends Model
{
    protected $fillable = [
        'purchase_id',
        'supplier_id',
        'transaction_id',
        'user_id',
        'amount',
        'date',
        'method',
        'reference',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'decimal:2',
    ];

    /**
     * Legacy relation kept for backward compatibility — only set for payments
     * created against a single purchase. Multi-purchase payments (created via
     * the supplier "Régler des achats" flow) leave this null; use `allocations()`
     * as the source of truth for which purchases a payment covers.
     */
    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function allocations()
    {
        return $this->hasMany(PurchasePaymentAllocation::class);
    }
}
