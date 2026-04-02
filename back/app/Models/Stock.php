<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand',
        'profile',
        'dimension',
        'width',
        'height',
        'diameter',
        'ic',
        'iv',
        'rft',
        'reinforced',
        'marking',
        'made_in',
        'dot',
        'depot',
        'zone',
        'quantity',
        'purchase_price',
        'selling_price',
        'special_price',
        'user_id',
    ];

    protected $casts = [
        'rft' => 'boolean',
        'reinforced' => 'boolean',
        'quantity' => 'integer',
        'purchase_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'special_price' => 'decimal:2',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function (Stock $stock) {
            if ($stock->isDirty('dimension') && $stock->dimension) {
                $parsed = static::parseDimension($stock->dimension);
                $stock->width = $parsed['width'];
                $stock->height = $parsed['height'];
                $stock->diameter = $parsed['diameter'];
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Parse a tire dimension string into width, height, diameter.
     *
     * Handles: 205/55R16, 155R12, 255/70R15C, 120/70ZR17, 155R13C, 3,50/10, 80/90-21
     */
    public static function parseDimension(string $dimension): array
    {
        $result = ['width' => null, 'height' => null, 'diameter' => null];
        $dim = trim($dimension);

        // Standard format: 205/55R16, 120/70ZR17, 255/70R15C
        if (preg_match('/^(\d{2,3})\/?(\d{2,3})?[A-Z]*R(\d{2,3})/i', $dim, $m)) {
            $result['width'] = (int) $m[1];
            $result['height'] = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : null;
            $result['diameter'] = (int) $m[3];
            return $result;
        }

        // Format without slash: 155R12, 155R13C
        if (preg_match('/^(\d{2,3})R(\d{2,3})/i', $dim, $m)) {
            $result['width'] = (int) $m[1];
            $result['diameter'] = (int) $m[2];
            return $result;
        }

        // Moto format with dash: 80/90-21
        if (preg_match('/^(\d{2,3})\/(\d{2,3})-(\d{2,3})/', $dim, $m)) {
            $result['width'] = (int) $m[1];
            $result['height'] = (int) $m[2];
            $result['diameter'] = (int) $m[3];
            return $result;
        }

        // Fallback: 3,50/10
        if (preg_match('/\/(\d{2,3})$/', $dim, $m)) {
            $result['diameter'] = (int) $m[1];
        }

        return $result;
    }

    /**
     * Parse a search query into dimension parts and text terms.
     */
    public static function parseSearchQuery(string $input): array
    {
        $tokens = preg_split('/\s+/', trim($input));
        $result = ['width' => null, 'height' => null, 'diameter' => null, 'text' => []];

        foreach ($tokens as $token) {
            if ($token === '') continue;

            // Try formatted dimension: 205/55R16, 120/70ZR17
            if (preg_match('/^(\d{2,3})\/?(\d{2,3})?[A-Z]*R(\d{2,3})/i', $token, $m)) {
                $result['width'] = (int) $m[1];
                $result['height'] = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : null;
                $result['diameter'] = (int) $m[3];
                continue;
            }

            // Try pure digits: 2055516, 20555, 205, 16
            if (preg_match('/^\d+$/', $token)) {
                $len = strlen($token);
                if ($len >= 7) {
                    $result['width'] = (int) substr($token, 0, 3);
                    $result['height'] = (int) substr($token, 3, 2);
                    $result['diameter'] = (int) substr($token, 5);
                } elseif ($len >= 5) {
                    $result['width'] = (int) substr($token, 0, 3);
                    $result['height'] = (int) substr($token, 3, 2);
                } elseif ($len === 3) {
                    $result['width'] = (int) $token;
                } elseif ($len === 2) {
                    $result['diameter'] = (int) $token;
                }
                continue;
            }

            $result['text'][] = $token;
        }

        return $result;
    }
}
