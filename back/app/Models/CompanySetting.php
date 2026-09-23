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
        'closed_weekdays',
        'holidays',
        'vat_rate',
    ];

    protected $appends = [
        'logo_url',
        'favicon_url',
    ];

    /**
     * Days of the week the shop is closed, 0 (Sunday) to 6 (Saturday) — the
     * same numbering as JavaScript's Date#getDay, so the front reads them as
     * they come.
     *
     * The default is Sunday rather than an empty list: the row written before
     * these columns existed holds null, and returning [] there would tell the
     * Primes projection that the shop never closes — a stronger claim than
     * "not yet answered".
     *
     * Written as an Attribute rather than an `array` cast because the cast
     * cannot express that default on read.
     */
    protected function closedWeekdays(): Attribute
    {
        return Attribute::make(
            get: function (?string $value): array {
                $decoded = json_decode((string) $value, true);

                if (! is_array($decoded)) {
                    return [0];
                }

                $days = array_filter(
                    array_map('intval', $decoded),
                    fn (int $day) => $day >= 0 && $day <= 6,
                );
                sort($days);

                return array_values(array_unique($days));
            },
            set: fn (?array $value) => json_encode(array_values($value ?? [0])),
        );
    }

    /** Exceptional closures, as `Y-m-d` strings. */
    protected function holidays(): Attribute
    {
        return Attribute::make(
            get: function (?string $value): array {
                $decoded = json_decode((string) $value, true);

                return is_array($decoded) ? array_values(array_map('strval', $decoded)) : [];
            },
            set: fn (?array $value) => json_encode(array_values($value ?? [])),
        );
    }

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
