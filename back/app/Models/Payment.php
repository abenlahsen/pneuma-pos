<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'transaction_id',
        'user_id',
        'amount',
        'amount_paid',
        'date',
        'payment_date',
        'paid_at',
        'method',
        'payment_method',
        'reference',
        'notes',
    ];

    protected $casts = [
        'amount' => 'float',
        'amount_paid' => 'float',
        'date' => 'date',
        'payment_date' => 'datetime',
        'paid_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
