<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One value of the collective bonus threshold, and the date it took effect.
 *
 * Append-only in practice: a change to `company_settings.prime_threshold`
 * writes a new row rather than editing the last one, so a past month can
 * always be read against the threshold that applied then.
 */
class PrimeThreshold extends Model
{
    protected $fillable = [
        'threshold',
        'effective_from',
        'created_by',
    ];

    protected $casts = [
        'threshold' => 'integer',
        'effective_from' => 'date',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The threshold in force on a given date, or null when the date precedes
     * every recorded value — the months before the table existed.
     */
    public static function inForceOn(string $date): ?int
    {
        return self::query()
            ->whereDate('effective_from', '<=', $date)
            ->orderByDesc('effective_from')
            ->orderByDesc('id')
            ->value('threshold');
    }
}
