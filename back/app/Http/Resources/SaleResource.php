<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $clientName = $this->relationLoaded('linkedClient') && $this->linkedClient
            ? $this->linkedClient->name
            : $this->client;

        $clientPhone = $this->relationLoaded('linkedClient') && $this->linkedClient
            ? $this->linkedClient->phone
            : $this->client_phone;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'date' => $this->formatDateValue($this->date ?? $this->sale_date),
            'sale_date' => $this->formatDateValue($this->sale_date ?? $this->date),
            'client' => $clientName,
            'client_phone' => $clientPhone,
            'brand' => $this->brand,
            'city' => $this->relationLoaded('linkedClient') && $this->linkedClient?->city
                ? $this->linkedClient->city
                : $this->city,
            'partner' => $this->partner,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'notes' => $this->notes,
            'client_id' => $this->client_id,
            'linked_client_id' => $this->client_id,
            'linked_client' => $this->when(
                $this->relationLoaded('linkedClient'),
                fn () => $this->linkedClient ? [
                    'id' => $this->linkedClient->id,
                    'name' => $this->linkedClient->name,
                    'phone' => $this->linkedClient->phone,
                    'city' => $this->linkedClient->city,
                ] : null
            ),
            'commercial_id' => $this->commercial_id,
            'commercial' => $this->when(
                $this->relationLoaded('commercial'),
                fn () => $this->commercial ? [
                    'id' => $this->commercial->id,
                    'name' => $this->commercial->name,
                ] : null,
                null
            ),
            'total_quantity' => (int) ($this->total_quantity ?? 0),
            'total_sale' => $this->formatMoneyValue($this->total_sale),
            'subtotal' => $this->formatMoneyValue($this->subtotal),
            'discount' => $this->formatMoneyValue($this->discount),
            'tax' => $this->formatMoneyValue($this->tax),
            'items' => $this->whenLoaded('items'),
            'payments' => $this->whenLoaded('payments'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    protected function formatMoneyValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    protected function formatDateValue(mixed $value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return $value;
    }
}
