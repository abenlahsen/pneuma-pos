<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Une baie de l'atelier, et le technicien qui y travaille (`3f`). */
class Bay extends Model
{
    protected $fillable = ['name', 'user_id', 'position', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function serviceOrders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class);
    }
}
