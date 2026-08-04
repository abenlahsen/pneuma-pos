<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentChangeRequestItem extends Model
{
    protected $fillable = [
        'shipment_change_request_id',
        'field',
        'custom_label',
        'old_value',
        'new_value',
        'sort_order',
    ];

    public function shipmentChangeRequest(): BelongsTo
    {
        return $this->belongsTo(ShipmentChangeRequest::class);
    }
}
