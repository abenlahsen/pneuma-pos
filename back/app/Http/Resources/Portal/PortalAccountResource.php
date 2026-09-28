<?php

namespace App\Http\Resources\Portal;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Un accès portail, vu de la fiche client (agence). Jamais de hachage de
 * jeton ni de mot de passe.
 */
class PortalAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'name' => $this->name,
            'email' => $this->email,
            'status' => $this->status,
            'invited_at' => $this->invited_at?->toIso8601String(),
            'invited_by' => $this->whenLoaded('inviter', fn () => $this->inviter ? ['id' => $this->inviter->id, 'name' => $this->inviter->name] : null),
            'activation_expires_at' => $this->activation_expires_at?->toIso8601String(),
            'activated_at' => $this->activated_at?->toIso8601String(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
        ];
    }
}
