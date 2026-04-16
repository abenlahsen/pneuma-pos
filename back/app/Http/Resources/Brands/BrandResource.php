<?php

namespace App\Http\Resources\Brands;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrandResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        $logoPath = $this->resource->logo;
        $logoUrl = $logoPath ? asset('storage/' . ltrim($logoPath, '/')) : null;

        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'logo' => $logoPath,
            'logo_url' => $logoUrl,
            'is_active' => (bool) $this->resource->is_active,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}