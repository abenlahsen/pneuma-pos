<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSaleRequest extends FormRequest
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
            'date' => ['required', 'date'],
            'client' => ['nullable', 'string'],
            'commercial_id' => ['nullable', 'exists:users,id'],
            'carrier_id' => ['nullable', 'exists:carriers,id'],
            'partner_id' => ['nullable', 'exists:partners,id'],
            'status' => ['nullable', 'string'],
            'payment_status' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string'],
            'comments' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.stock_id' => ['nullable', 'exists:stocks,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.selling_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
