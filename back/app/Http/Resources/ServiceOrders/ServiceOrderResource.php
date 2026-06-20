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
            'vehicle_id' => $this->vehicle_id,
            'vehicle_data' => $this->when(
                $this->relationLoaded('vehicle'),
                function () {
                    $v = $this->getRelation('vehicle');
                    return $v ? [
                        'id'                => $v->id,
                        'plate'             => $v->plate,
                        'brand'             => $v->brand,
                        'model_name'        => $v->model_name,
                        'circulation_month' => $v->circulation_month,
                        'circulation_year'  => $v->circulation_year,
                        'display_name'      => $v->display_name,
                    ] : null;
                }
            ),
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
                    'item_type' => $item->item_type ?? 'service',
                    'service_type' => $item->service_type,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->profile,
                    'product_reference' => $item->product?->reference,
                    'quantity' => (int) ($item->quantity ?? 1),
                    'unit_price' => number_format((float) ($item->unit_price ?? 0), 2, '.', ''),
                    'purchase_price' => number_format((float) ($item->purchase_price ?? 0), 2, '.', ''),
                    'total_quantity' => $item->item_type === 'part' ? (int) ($item->product?->stocks_sum_quantity ?? 0) : null,
                    'stock_id' => $item->stock_id,
                    'description' => $item->description,
                    'parts_cost' => number_format((float) $item->parts_cost, 2, '.', ''),
                    'labor_cost' => number_format((float) $item->labor_cost, 2, '.', ''),
                    'line_total' => number_format((float) $item->line_total, 2, '.', ''),
                    'sort_order' => $item->sort_order,
                ])
            ),
            'total_amount' => number_format((float) $this->total_amount, 2, '.', ''),
            'total_purchase' => number_format((float) $this->total_purchase, 2, '.', ''),
            'margin' => number_format((float) $this->margin, 2, '.', ''),
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
            'creator' => $this->when(
                $this->relationLoaded('creator'),
                fn () => $this->creator ? [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                ] : null
            ),
            'payments' => $this->whenLoaded('payments'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
