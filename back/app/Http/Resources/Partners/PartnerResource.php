<?php

namespace App\Http\Resources\Partners;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PartnerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'city' => $this->resource->city,
            'phone' => $this->resource->phone,
            'mobile' => $this->resource->mobile,
            'address' => $this->resource->address,
            'montage_price' => $this->resource->montage_price,
            'alignment_price' => $this->resource->alignment_price,
            'user_id' => $this->resource->user_id,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}