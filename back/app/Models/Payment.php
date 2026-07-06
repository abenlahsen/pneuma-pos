<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'client_id',
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

    /**
     * Legacy relation kept for backward compatibility — only set for payments
     * created against a single sale. Multi-sale payments (created via the
     * client "Régler des ventes" flow) leave this null; use `allocations()`
     * as the source of truth for which sales a payment covers.
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(SalePaymentAllocation::class);
    }
}
