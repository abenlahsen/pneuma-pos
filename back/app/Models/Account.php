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

    /**
     * Transactions belonging to this account.
     */
    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Computed current balance: initial_balance + settled income - settled expenses.
     * Excludes future-dated Chèque/Effet payments (écheance not yet reached).
     */
    public function getCurrentBalanceAttribute()
    {
        $income = $this->transactions()->settled()->where('type', 'income')->sum('amount');
        $expense = $this->transactions()->settled()->where('type', 'expense')->sum('amount');

        return round((float) $this->initial_balance + $income - $expense, 2);
    }

    /**
     * Expected balance: current balance + pending (future Chèque/Effet) net flow.
     */
    public function getExpectedBalanceAttribute()
    {
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