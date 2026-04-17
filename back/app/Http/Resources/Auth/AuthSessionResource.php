<?php

namespace App\Http\Resources\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthSessionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->resource['user'] ?? null;
        $permissions = $this->resource['permissions'] ?? [];
        $token = $this->resource['token'] ?? null;
        $mustChangePassword = $this->resource['must_change_password']
            ?? ($user ? (bool) $user->must_change_password : false);

        return [
            'user' => $user ? new AuthUserResource($user) : null,
            'permissions' => collect($permissions)->values(),
            'token' => $token,
            'must_change_password' => (bool) $mustChangePassword,
        ];
    }
}