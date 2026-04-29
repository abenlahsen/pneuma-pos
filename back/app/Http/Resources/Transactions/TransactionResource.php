<?php

namespace App\Http\Resources\Transactions;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
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
            'account_id' => $this->account_id,
            'type' => $this->type,
            'category' => $this->category,
            'method' => $this->method,
            'partner' => $this->partner,
            'person' => $this->person,
            'amount' => $this->amount,
            'date' => $this->date?->format('Y-m-d'),
            'description' => $this->description,
            'reference' => $this->reference,
            'account' => $this->whenLoaded('account'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
