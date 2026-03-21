<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesRep extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'commission_rate',
        'user_id'
    ];

    protected $casts = [
        'commission_rate' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
