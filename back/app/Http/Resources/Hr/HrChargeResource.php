<?php

namespace App\Http\Resources\Hr;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HrChargeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date ? (string) $this->date : null,
            'employee_id' => $this->employee_id,
            'employee_name' => $this->employee?->name ?? $this->person,
            'subcategory' => $this->subcategory,
            'amount' => (float) $this->amount,
            'method' => $this->method,
            'description' => $this->description,
            'account' => $this->whenLoaded('account', fn () => [
                'id' => $this->account->id,
                'name' => $this->account->name,
            ]),
        ];
    }
}
