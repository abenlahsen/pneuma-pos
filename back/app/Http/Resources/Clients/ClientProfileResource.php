<?php

namespace App\Http\Resources\Clients;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $lastSaleDate = $this['last_sale_date'] ?? null;

        if (is_object($lastSaleDate) && method_exists($lastSaleDate, 'toDateString')) {
            $lastSaleDate = $lastSaleDate->toDateString();
        }

        return [
            'client' => new ClientResource($this['client']),
            'sales_count' => (int) ($this['sales_count'] ?? 0),
            'total_purchased' => round((float) ($this['total_purchased'] ?? 0), 2),
            'last_sale_date' => $lastSaleDate,
            'outstanding_balance' => round((float) ($this['outstanding_balance'] ?? 0), 2),
            'sales' => $this['sales'] ?? [],
            'sales_history' => $this['sales_history'] ?? $this['sales'] ?? [],
        ];
    }
}