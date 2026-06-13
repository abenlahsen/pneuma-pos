<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'description',
        'initial_balance',
        'is_active',
    ];

    protected $casts = [
        'initial_balance' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    protected $appends = ['current_balance', 'expected_balance'];

    private ?float $cachedCurrentBalance = null;

    /**
     * Transactions belonging to this account.
     */
    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Computed current balance: initial_balance + settled income - settled expenses.
     * Uses pre-loaded aggregates from AccountService::list() when available,
     * otherwise queries the DB (result is memoized to avoid double-query from getExpectedBalanceAttribute).
     */
    public function getCurrentBalanceAttribute(): float
    {
        if (isset($this->attributes['settled_income'])) {
            return round(
                (float) $this->initial_balance
                + (float) $this->attributes['settled_income']
                - (float) $this->attributes['settled_expense'],
                2
            );
        }

        if ($this->cachedCurrentBalance === null) {
            $income = $this->transactions()->settled()->where('type', 'income')->sum('amount');
            $expense = $this->transactions()->settled()->where('type', 'expense')->sum('amount');
            $this->cachedCurrentBalance = round((float) $this->initial_balance + $income - $expense, 2);
        }

        return $this->cachedCurrentBalance;
    }

    /**
     * Expected balance: current balance + pending (future Chèque/Effet) net flow.
     * Uses pre-loaded aggregates from AccountService::list() when available.
     */
    public function getExpectedBalanceAttribute(): float
    {
        if (isset($this->attributes['pending_income'])) {
            return round(
                $this->current_balance
                + (float) $this->attributes['pending_income']
                - (float) $this->attributes['pending_expense'],
                2
            );
        }

        $pendingIncome = $this->transactions()->pending()->where('type', 'income')->sum('amount');
        $pendingExpense = $this->transactions()->pending()->where('type', 'expense')->sum('amount');

        return round($this->current_balance + $pendingIncome - $pendingExpense, 2);
    }

    /**
     * Scope: only active accounts.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}