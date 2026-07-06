<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchasePaymentAllocation extends Model
{
    protected $fillable = [
        'purchase_payment_id',
        'purchase_id',
        'amount',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function payment()
    {
        return $this->belongsTo(PurchasePayment::class, 'purchase_payment_id');
    }

    public function purchase()
    {
        return $this->belongsTo(Purchase::class);
    }
}
