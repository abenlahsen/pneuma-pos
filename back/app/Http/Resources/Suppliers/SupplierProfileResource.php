<?php

namespace App\Http\Resources\Suppliers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'supplier'          => new SupplierResource($this['supplier']),
            'purchases_count'   => (int) ($this['purchases_count'] ?? 0),
            'total_purchased'   => round((float) ($this['total_purchased'] ?? 0), 2),
            'last_purchase_date' => $this['last_purchase_date'] ?? null,
            'outstanding_balance' => round((float) ($this['outstanding_balance'] ?? 0), 2),
            'purchases'         => $this['purchases'] ?? [],
        ];
    }
}
