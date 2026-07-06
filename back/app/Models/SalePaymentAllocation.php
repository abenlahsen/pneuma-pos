<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalePaymentAllocation extends Model
{
    protected $fillable = [
        'payment_id',
        'sale_id',
        'amount',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }
}
