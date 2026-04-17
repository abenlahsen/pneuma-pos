<?php

namespace App\Http\Resources\Products;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'profile' => $this->profile,
            'reference' => $this->reference,
            'type' => $this->type,
            'brand_id' => $this->brand_id,
            'description' => $this->description,
            'unit' => $this->unit,
            'is_active' => (bool) $this->is_active,
            'brand' => $this->whenLoaded('brand'),
            'tyre' => $this->whenLoaded('tyre'),
            'part' => $this->whenLoaded('part'),
            'service' => $this->whenLoaded('service'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
