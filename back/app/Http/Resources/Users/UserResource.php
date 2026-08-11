<?php

namespace App\Http\Resources\Users;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'commission_rate' => $this->resource->commission_rate,
            'prime_per_tyre' => $this->resource->prime_per_tyre,
            'must_change_password' => (bool) $this->resource->must_change_password,
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
            // Salary and other HR fields are only sold to callers who can see
            // Charges RH — `view users` alone (granted to Commercial) must not
            // expose payroll data.
            $this->mergeWhen((bool) $request->user()?->can('view hr-charges'), [
                'salary' => $this->resource->salary,
                'cnss_number' => $this->resource->cnss_number,
                'hire_date' => $this->resource->hire_date,
            ]),
        ];
    }
}
