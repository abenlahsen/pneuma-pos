<?php

namespace App\Http\Resources\Clients;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientStatementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'client' => new ClientResource($this['client']),
            'summary' => $this['summary'] ?? [],
            'sales' => $this['sales'] ?? [],
            'payments' => $this['payments'] ?? [],
            'entries' => $this['entries'] ?? [],
        ];
    }
}