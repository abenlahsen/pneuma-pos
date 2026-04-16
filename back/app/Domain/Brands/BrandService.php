<?php

namespace App\Domain\Brands;

use App\Models\Brand;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class BrandService
{
    /**
     * @param  array<string, mixed>  $validated
     * @param  UploadedFile|null  $logo
     * @return Brand
     */
    public function create(array $validated, $logo = null)
    {
        $payload = $this->preparePayload($validated, $logo);

        return Brand::create($payload);
    }

    /**
     * @param  Brand  $brand
     * @param  array<string, mixed>  $validated
     * @param  UploadedFile|null  $logo
     * @return Brand
     */
    public function update($brand, array $validated, $logo = null)
    {
        $payload = $this->preparePayload($validated, $logo, $brand);

        if ($logo === null) {
            unset($payload['logo']);
        }

        $brand->update($payload);

        return $brand->fresh();
    }

    /**
     * @param  Brand  $brand
     * @return void
     */
    public function delete($brand)
    {
        if ($brand->products()->exists()) {
            throw ValidationException::withMessages([
                'brand' => 'Cette marque ne peut pas être supprimée car elle est utilisée par des produits.',
            ]);
        }

        if ($brand->logo) {
            Storage::disk('public')->delete($brand->logo);
        }

        $brand->delete();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  UploadedFile|null  $logo
     * @param  Brand|null  $brand
     * @return array<string, mixed>
     */
    private function preparePayload(array $validated, $logo = null, $brand = null)
    {
        $validated['is_active'] = (bool) ($validated['is_active'] ?? true);

        if ($logo !== null) {
            if ($brand !== null && $brand->logo) {
                Storage::disk('public')->delete($brand->logo);
            }

            $validated['logo'] = $logo->store('brands', 'public');
        }

        return $validated;
    }
}