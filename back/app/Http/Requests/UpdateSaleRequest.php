<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => 'nullable|date',
            'with_invoice' => 'boolean',
            'quantity' => 'nullable|integer',
            'dimension' => 'nullable|string|max:255',
            'ic' => 'nullable|string|max:255',
            'iv' => 'nullable|string|max:255',
            'rft' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
            'profile' => 'nullable|string|max:255',
            'purchase_price' => 'nullable|numeric|min:0',
            'total_purchase' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'total_sale' => 'nullable|numeric|min:0',
            'margin' => 'nullable|numeric',
            'supplier' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'transport' => 'nullable|string|max:255',
            'partner' => 'nullable|string|max:255',
            'service' => 'nullable|string|max:255',
            'service_fee' => 'nullable|numeric|min:0',
            'client' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|max:255',
            'sales_rep' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:255',
            'payment_status' => 'nullable|string|max:255',
            'delivery_date' => 'nullable|date',
            'comments' => 'nullable|string',
        ];
    }
}
