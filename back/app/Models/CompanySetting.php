<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySetting extends Model
{
    protected $fillable = [
        'company_name',
        'legal_name',
        'email',
        'phone',
        'address',
        'city',
        'city_id',
        'state',
        'postal_code',
        'country',
        'tax_id',
        'rc',
        'ice',
        'cnss',
        'patente',
        'logo_path',
        'favicon_path',
        'theme_mode',
        'primary_color',
        'accent_color',
        'surface_color',
        'menu_layout',
        'navbar_variant',
        'content_width',
        'prime_threshold',
    ];

    protected $appends = [
        'logo_url',
        'favicon_url',
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

    public function getLogoUrlAttribute(): ?string
    {
        return $this->buildPublicUrl($this->logo_path);
    }

    public function getFaviconUrlAttribute(): ?string
    {
        return $this->buildPublicUrl($this->favicon_path);
    }

    private function buildPublicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        // Return a root-relative URL so it works regardless of APP_URL
        // (avoids internal Docker hostnames reaching the browser).
        $url = '/storage/'.ltrim($path, '/');
        $updatedAt = $this->updated_at?->timestamp;

        return $updatedAt ? "{$url}?v={$updatedAt}" : $url;
    }
}
