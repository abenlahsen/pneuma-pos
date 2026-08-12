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
            'city' => $this->when(
                $this->relationLoaded('linkedClient'),
                fn () => $this->linkedClient?->city
            ),
            'with_invoice' => (bool) $this->with_invoice,
            'carrier_id' => $this->carrier_id,
            'tracking_number' => $this->tracking_number,
            'carrier' => $this->when(
                $this->relationLoaded('linkedCarrier'),
                fn () => $this->linkedCarrier ? [
                    'id' => $this->linkedCarrier->id,
                    'name' => $this->linkedCarrier->name,
                ] : null
            ),
            'partner_id' => $this->partner_id,
            'service' => $this->service,
            'partner' => $this->when(
                $this->relationLoaded('linkedPartner'),
                fn () => $this->linkedPartner ? [
                    'id' => $this->linkedPartner->id,
                    'name' => $this->linkedPartner->name,
                ] : null,
                $this->partner
            ),
            'payment_methods' => $this->payment_methods,
            'delivery_date' => $this->formatDateValue($this->delivery_date),
            'comments' => $this->comments,
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
            'creator' => $this->when(
                $this->relationLoaded('creator'),
                fn () => $this->creator ? [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                ] : null,
                null
            ),
            'total_quantity' => (int) ($this->total_quantity ?? 0),
            'total_purchase' => $this->formatMoneyValue($this->total_purchase),
            'total_sale' => $this->formatMoneyValue($this->total_sale),
            'subtotal' => $this->formatMoneyValue($this->subtotal),
            'discount' => $this->formatMoneyValue($this->discount),
            'tax' => $this->formatMoneyValue($this->tax),
            'margin' => $this->formatMoneyValue($this->margin),
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
