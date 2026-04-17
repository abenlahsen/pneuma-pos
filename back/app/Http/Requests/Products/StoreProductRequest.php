<?php

namespace App\Http\Requests\Products;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules()
    {
        return [
            'profile' => 'nullable|string|max:255',
            'reference' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('products', 'reference')->where(fn ($query) => $query->whereNotNull('reference')),
            ],
            'type' => 'required|in:tyre,part,service',
            'brand_id' => 'nullable|exists:brands,id',
            'description' => 'nullable|string',
            'unit' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
            'tire_width' => 'nullable|integer|min:0',
            'tire_height' => 'nullable|integer|min:0',
            'tire_diameter' => 'nullable|integer|min:0',
            'tire_load_index' => 'nullable|string|max:20',
            'tire_speed_index' => 'nullable|string|max:10',
            'tire_season' => 'nullable|in:summer,winter,all_season',
            'tire_runflat' => 'nullable|boolean',
            'tire_reinforced' => 'nullable|boolean',
            'tire_marking' => 'nullable|string|max:255',
            'eu_fuel' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_wet_grip' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_noise_db' => 'nullable|integer|min:0|max:999',
            'eu_noise_class' => 'nullable|string|size:1|in:A,B,C',
            'part_category' => 'nullable|in:brakes,lubricants,engine,suspension,filters,electrical,body,other',
            'oem_reference' => 'nullable|string|max:255',
            'compatibility' => 'nullable|string',
            'service_category' => 'nullable|in:mechanical,oil,tires,bodywork,diagnostic,other',
            'duration_minutes' => 'nullable|integer|min:0|max:10000',
            'selling_price' => 'nullable|numeric|min:0',
        ];
    }
}
