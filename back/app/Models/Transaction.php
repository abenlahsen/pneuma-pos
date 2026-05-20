<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'amount',
        'type',
        'category',
        'method',
        'description',
        'person',
        'partner_id',
        'user_id',
        'account_id',
        'transfer_id',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
        'partner_id' => 'integer',
    ];

    /**
     * The user who created this transaction.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The account this transaction belongs to.
     */
    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Partner::class);
    }

    /**
     * Scope to filter by type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope to filter by category.
     */
    public function scopeOfCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Scope: only "settled" transactions — i.e., everything except future-dated
     * Chèque/Effet payments which are considered pending until their écheance.
     */
    public function scopeSettled($query)
    {
        return $query->where(function ($q) {
            $q->whereNotIn('method', ['Chèque', 'Effet'])
                ->orWhereNull('method')
                ->orWhere('date', '<=', now()->toDateString());
        });
    }

    /**
     * Scope: only pending (future-dated Chèque/Effet) transactions.
     */
    public function scopePending($query)
    {
        return $query->whereIn('method', ['Chèque', 'Effet'])
            ->where('date', '>', now()->toDateString());
    }

    /**
     * Scope to filter by date range.
     */
    public function scopeDateBetween($query, $from, $to)
    {
        if ($from) {
            $query->where('date', '>=', $from);
        }
        if ($to) {
            $query->where('date', '<=', $to);
        }

        return $query;
    }
}