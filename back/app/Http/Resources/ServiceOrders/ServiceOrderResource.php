<?php

namespace App\Http\Resources\ServiceOrders;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date instanceof \DateTimeInterface
                ? $this->date->format('Y-m-d')
                : $this->date,
            'client' => $this->client,
            'phone' => $this->phone,
            'vehicle' => $this->vehicle,
            'mileage' => $this->mileage,
            'items' => $this->whenLoaded('items'),
            'total_amount' => number_format((float) $this->total_amount, 2, '.', ''),
            'discount' => number_format((float) $this->discount, 2, '.', ''),
            'net_amount' => number_format((float) $this->net_amount, 2, '.', ''),
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'notes' => $this->notes,
            'commercial_id' => $this->commercial_id,
            'commercial' => $this->when(
                $this->relationLoaded('commercial'),
                fn () => $this->commercial ? [
                    'id' => $this->commercial->id,
                    'name' => $this->commercial->name,
                ] : null
            ),
            'payments' => $this->whenLoaded('payments'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
