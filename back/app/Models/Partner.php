<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Partner extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'city',
        'city_id',
        'phone',
        'mobile',
        'address',
        'montage_price',
        'alignment_price',
        'user_id',
    ];

    protected $casts = [
        'montage_price' => 'decimal:2',
        'alignment_price' => 'decimal:2',
    ];

    public function cityRelation(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city_id');
    }

    protected function city(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->cityRelation?->name,
            set: function (?string $value) {
                if (! $value) {
                    return ['city_id' => null];
                }
                $city = City::where('name', $value)->first();

                return ['city_id' => $city?->id];
            }
        );
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
