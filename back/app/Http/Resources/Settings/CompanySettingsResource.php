<?php

namespace App\Http\Resources\Settings;

use Illuminate\Http\Resources\Json\JsonResource;

class CompanySettingsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->resource->id,
            'company_name' => $this->resource->company_name,
            'legal_name' => $this->resource->legal_name,
            'email' => $this->resource->email,
            'phone' => $this->resource->phone,
            'address' => $this->resource->address,
            'city' => $this->resource->city,
            'state' => $this->resource->state,
            'postal_code' => $this->resource->postal_code,
            'country' => $this->resource->country,
            'tax_id' => $this->resource->tax_id,
            'rc' => $this->resource->rc,
            'ice' => $this->resource->ice,
            'cnss' => $this->resource->cnss,
            'patente' => $this->resource->patente,
            'logo_path' => $this->resource->logo_path,
            'logo_url' => $this->resource->logo_url,
            'favicon_path' => $this->resource->favicon_path,
            'favicon_url' => $this->resource->favicon_url,
            'theme_mode' => $this->resource->theme_mode ?? 'system',
            'primary_color' => $this->resource->primary_color ?? '#ff2d37',
            'accent_color' => $this->resource->accent_color ?? '#1e293b',
            'surface_color' => $this->resource->surface_color ?? '#ffffff',
            'menu_layout' => $this->resource->menu_layout ?? 'vertical',
            'navbar_variant' => $this->resource->navbar_variant ?? 'default',
            'content_width' => $this->resource->content_width ?? 'full',
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
