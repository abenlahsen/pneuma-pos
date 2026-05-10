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
            'client_id' => $this->client_id,
            'client_record' => $this->whenLoaded('clientRecord', fn () => $this->clientRecord ? [
                'id' => $this->clientRecord->id,
                'name' => $this->clientRecord->name,
                'phone' => $this->clientRecord->phone,
            ] : null),
            'date' => $this->date instanceof \DateTimeInterface
                ? $this->date->format('Y-m-d')
                : $this->date,
            'vehicle' => $this->vehicle,
            'mileage' => $this->mileage,
            'items' => $this->whenLoaded('items', fn () =>
                $this->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product' => $item->product ? [
                        'id' => $item->product->id,
                        'profile' => $item->product->profile,
                        'reference' => $item->product->reference,
                        'selling_price' => $item->product->service?->selling_price,
                    ] : null,
                    'description' => $item->description,
                    'parts_cost' => number_format((float) $item->parts_cost, 2, '.', ''),
                    'labor_cost' => number_format((float) $item->labor_cost, 2, '.', ''),
                    'line_total' => number_format((float) $item->line_total, 2, '.', ''),
                    'sort_order' => $item->sort_order,
                ])
            ),
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
