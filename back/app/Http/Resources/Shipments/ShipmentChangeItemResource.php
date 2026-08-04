<?php

namespace App\Http\Resources\Shipments;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentChangeItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'field' => $this->field,
            'custom_label' => $this->custom_label,
            'old_value' => $this->old_value,
            'new_value' => $this->new_value,
            'sort_order' => $this->sort_order,
        ];
    }
}
