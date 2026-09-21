<?php

namespace App\Http\Resources\Carriers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CarrierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'phone' => $this->resource->phone,
            'email' => $this->resource->email,
            'user_id' => $this->resource->user_id,
            // Nombre de ventes livrées — absent de la réponse quand il n'a pas
            // été compté, pour que le front distingue « aucune » de « inconnu ».
            'sales_count' => $this->whenCounted('sales'),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}