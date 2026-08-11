<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    const UPDATED_AT = null;

    const ACTION_CREATE = 'CREATE';

    const ACTION_UPDATE = 'UPDATE';

    const ACTION_DELETE = 'DELETE';

    const ACTION_PAYMENT_ADD = 'PAYMENT_ADD';

    const ACTION_PAYMENT_DELETE = 'PAYMENT_DELETE';

    const ENTITY_VENTE = 'vente';

    const ENTITY_ACHAT = 'achat';

    const ENTITY_SERVICE_ORDER = 'service_order';

    const ENTITY_COMPTE = 'compte';

    const ENTITY_TRANSACTION = 'transaction';

    const ENTITY_SHIPMENT_CHANGE = 'shipment_change';

    protected $fillable = [
        'action',
        'entity_type',
        'is_confidential',
        'entity_id',
        'entity_label',
        'description',
        'properties',
        'user_id',
        'user_name',
    ];

    protected $casts = [
        'is_confidential' => 'boolean',
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
