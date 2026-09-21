<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Carrier extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'user_id'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Les ventes que ce transporteur a livrées. La clé étrangère est en
     * nullOnDelete : supprimer un transporteur ne détruit pas ses ventes, il
     * les laisse sans transporteur. D'où le compte affiché avant l'action.
     *
     * @return HasMany
     */
    public function sales()
    {
        return $this->hasMany(Sale::class, 'carrier_id');
    }
}