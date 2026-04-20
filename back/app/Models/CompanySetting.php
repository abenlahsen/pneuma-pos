<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class CompanySetting extends Model
{
    protected $fillable = [
        'company_name',
        'legal_name',
        'email',
        'phone',
        'address',
        'city',
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
    ];

    protected $appends = [
        'logo_url',
        'favicon_url',
    ];

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

        $url = Storage::disk('public')->url($path);
        $updatedAt = $this->updated_at?->timestamp;

        return $updatedAt ? "{$url}?v={$updatedAt}" : $url;
    }
}
