<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanySettingsRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'remove_logo' => filter_var($this->input('remove_logo'), FILTER_VALIDATE_BOOLEAN),
            'remove_favicon' => filter_var($this->input('remove_favicon'), FILTER_VALIDATE_BOOLEAN),
        ]);
    }

    public function rules()
    {
        return [
            'company_name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:255'],
            'rc' => ['nullable', 'string', 'max:255'],
            'ice' => ['nullable', 'string', 'max:255'],
            'cnss' => ['nullable', 'string', 'max:255'],
            'patente' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'file', 'image', 'max:5120'],
            'favicon' => ['nullable', 'file', 'mimes:ico,png,jpg,jpeg,svg,webp', 'max:2048'],
            'remove_logo' => ['nullable', 'boolean'],
            'remove_favicon' => ['nullable', 'boolean'],
            'theme_mode' => ['nullable', 'in:light,dark,system'],
            'primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'accent_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'surface_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'menu_layout' => ['nullable', 'in:horizontal,vertical'],
            'navbar_variant' => ['nullable', 'in:default,compact,flat'],
            'content_width' => ['nullable', 'in:full,boxed,compact'],
        ];
    }
}
