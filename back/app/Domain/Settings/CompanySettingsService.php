<?php

namespace App\Domain\Settings;

use App\Models\CompanySetting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class CompanySettingsService
{
    public function get(): CompanySetting
    {
        return CompanySetting::query()->first() ?? new CompanySetting([
            'company_name' => '',
            'legal_name' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'postal_code' => null,
            'country' => null,
            'tax_id' => null,
            'rc' => null,
            'ice' => null,
            'cnss' => null,
            'patente' => null,
            'logo_path' => null,
            'favicon_path' => null,
            'theme_mode' => 'system',
            'primary_color' => '#ff2d37',
            'accent_color' => '#1e293b',
            'surface_color' => '#ffffff',
            'menu_layout' => 'vertical',
            'navbar_variant' => 'default',
            'content_width' => 'full',
        ]);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(array $data): CompanySetting
    {
        $settings = CompanySetting::query()->first();

        if (! $settings) {
            $settings = new CompanySetting([
                'theme_mode' => 'system',
                'primary_color' => '#ff2d37',
                'accent_color' => '#1e293b',
                'surface_color' => '#ffffff',
                'menu_layout' => 'vertical',
                'navbar_variant' => 'default',
                'content_width' => 'full',
            ]);
        }

        if (($data['remove_logo'] ?? false) === true) {
            $this->deleteFile($settings->logo_path);
            $data['logo_path'] = null;
        }

        if (($data['remove_favicon'] ?? false) === true) {
            $this->deleteFile($settings->favicon_path);
            $data['favicon_path'] = null;
        }

        if (isset($data['logo']) && $data['logo'] instanceof UploadedFile) {
            $this->deleteFile($settings->logo_path);
            $data['logo_path'] = $data['logo']->store('settings/company', 'public');
        }

        if (isset($data['favicon']) && $data['favicon'] instanceof UploadedFile) {
            $this->deleteFile($settings->favicon_path);
            $data['favicon_path'] = $data['favicon']->store('settings/company', 'public');
        }

        unset($data['logo'], $data['favicon'], $data['remove_logo'], $data['remove_favicon']);

        $settings->fill($data);
        $settings->save();

        return $settings->fresh();
    }

    private function deleteFile(?string $path): void
    {
        if (! $path) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
