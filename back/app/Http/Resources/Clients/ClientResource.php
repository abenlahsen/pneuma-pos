<?php

namespace App\Http\Resources\Clients;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'phone' => $this->phone,
            'email' => $this->email,
            'city' => $this->city,
            'address' => $this->address,
            'notes' => $this->notes,
            'is_active' => (bool) $this->is_active,
            'credit_limit' => $this->credit_limit !== null ? round((float) $this->credit_limit, 2) : null,
            'opening_balance' => $this->opening_balance !== null ? round((float) $this->opening_balance, 2) : null,
            'payment_terms_days' => $this->payment_terms_days !== null ? (int) $this->payment_terms_days : null,
            'default_payment_method' => $this->default_payment_method,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
