<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'made_in',
        'dot',
        'depot',
        'zone',
        'quantity',
        'purchase_price',
        'user_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'purchase_price' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Parse a search query into dimension parts and text terms.
     * Used to search stock via product dimensions.
     */
    public static function parseSearchQuery(string $input): array
    {
        $tokens = preg_split('/\s+/', trim($input));
        $result = ['width' => null, 'height' => null, 'diameter' => null, 'text' => []];

        foreach ($tokens as $token) {
            if ($token === '') continue;

            if (preg_match('/^(\d{2,3})\/?(\d{2,3})?[A-Z]*R(\d{2,3})/i', $token, $m)) {
                $result['width'] = (int) $m[1];
                $result['height'] = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : null;
                $result['diameter'] = (int) $m[3];
                continue;
            }

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
