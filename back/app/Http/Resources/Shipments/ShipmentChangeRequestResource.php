<?php

namespace App\Http\Resources\Shipments;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentChangeRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sale_id' => $this->sale_id,
            'sale' => $this->whenLoaded('sale', fn () => $this->sale ? [
                'id' => $this->sale->id,
                'date' => $this->sale->date instanceof \DateTimeInterface
                    ? $this->sale->date->format('Y-m-d')
                    : $this->sale->date,
                'client' => $this->sale->client,
                'tracking_number' => $this->sale->tracking_number,
                'total_sale' => number_format((float) $this->sale->total_sale, 2, '.', ''),
                // Refonte 2b, 9d : le nombre de colis sur la lettre au
                // transporteur. C'est la quantité totale de la vente, déjà
                // tenue par l'en-tête — rien à recalculer.
                'total_quantity' => (int) $this->sale->total_quantity,
            ] : null),
            'carrier_id' => $this->carrier_id,
            'carrier' => $this->whenLoaded('carrier', fn () => $this->carrier ? [
                'id' => $this->carrier->id,
                'name' => $this->carrier->name,
                'phone' => $this->carrier->phone,
                'email' => $this->carrier->email,
            ] : null),
            'shipment_number' => $this->shipment_number,
            'date' => $this->date instanceof \DateTimeInterface
                ? $this->date->format('Y-m-d')
                : $this->date,
            'status' => $this->status,
            'sent_at' => $this->sent_at?->toISOString(),
            'carrier_response' => $this->carrier_response,
            'reason' => $this->reason,
            'items' => $this->whenLoaded('items', fn () => ShipmentChangeItemResource::collection($this->items)->resolve()),
            // Refonte 2b, 9d : le signataire de la lettre. Son rôle vient avec,
            // parce que le transporteur a besoin de savoir qui engage la
            // boutique — pas seulement d'un nom.
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
                'role' => $this->creator->getRoleNames()->first(),
            ] : null),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
