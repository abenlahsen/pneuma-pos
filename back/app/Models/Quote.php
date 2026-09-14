<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Devis. Voir la migration pour ce qui est deliberement absent (lignes,
 * conversion en vente) : ce modele porte ce que la file « Devis sans reponse »
 * de l'accueil exige, pas davantage.
 */
class Quote extends Model
{
    protected $fillable = [
        'reference', 'client_id', 'commercial_id', 'issued_at', 'valid_until',
        'total_amount', 'status', 'responded_at', 'notes', 'created_by',
    ];

    protected $casts = [
        'issued_at' => 'date',
        'valid_until' => 'date',
        'responded_at' => 'datetime',
        'total_amount' => 'decimal:2',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }
}
