<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'user_id'
    ];

    /**
     * The user who created this supplier.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
