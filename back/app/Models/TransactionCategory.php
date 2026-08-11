<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TransactionCategory extends Model
{
    protected $fillable = [
        'name',
        'type',
        'parent_id',
        'is_system',
        'is_active',
        'counts_as_expense',
        'counts_as_revenue',
        'is_confidential',
        'sort_order',
    ];

    protected $casts = [
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'counts_as_expense' => 'boolean',
        'counts_as_revenue' => 'boolean',
        'is_confidential' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(TransactionCategory::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Names of the top-level, non-system expense categories that should
     * count towards the dashboard "Dépenses" / "Marge Nette" KPI.
     *
     * @return array<int, string>
     */
    public static function expenseKpiNames(): array
    {
        return static::query()
            ->topLevel()
            ->ofType('expense')
            ->where('is_system', false)
            ->where('counts_as_expense', true)
            ->pluck('name')
            ->all();
    }

    /**
     * Names of the top-level, non-system income categories that should
     * count towards the dashboard CA / Marge Brute / Marge Nette KPIs —
     * cash-flow revenue with no linked Sale/ServiceOrder (e.g. 'Occasion').
     *
     * @return array<int, string>
     */
    public static function revenueKpiNames(): array
    {
        return static::query()
            ->topLevel()
            ->ofType('income')
            ->where('is_system', false)
            ->where('counts_as_revenue', true)
            ->pluck('name')
            ->all();
    }

    /**
     * Names of the top-level categories flagged confidential (e.g. 'Charges
     * RH'). Used as an exclusion list everywhere transactions are read by a
     * user without the `view hr-charges` permission — see
     * Transaction::scopeVisible().
     *
     * @return array<int, string>
     */
    public static function confidentialNames(): array
    {
        return static::query()
            ->topLevel()
            ->where('is_confidential', true)
            ->pluck('name')
            ->all();
    }
}
