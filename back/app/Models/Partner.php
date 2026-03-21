<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Partner extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'city',
        'phone',
        'mobile',
        'address',
        'montage_price',
        'alignment_price',
        'user_id'
    ];

    protected $casts = [
        'montage_price' => 'decimal:2',
        'alignment_price' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
