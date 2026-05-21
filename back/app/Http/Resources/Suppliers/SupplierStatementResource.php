<?php

namespace App\Http\Resources\Suppliers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierStatementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'supplier'  => new SupplierResource($this['supplier']),
            'summary'   => $this['summary'] ?? [],
            'purchases' => $this['purchases'] ?? [],
            'payments'  => $this['payments'] ?? [],
            'entries'   => $this['entries'] ?? [],
        ];
    }
}
