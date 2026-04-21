<?php

namespace App\Http\Resources\Sales;

use App\Http\Resources\Clients\ClientResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client' => $this->client,
            'client_phone' => $this->client_phone,
            'client_id' => $this->client_id,
            'linked_client' => $this->whenLoaded('clientRelation', fn () => new ClientResource($this->clientRelation)),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}