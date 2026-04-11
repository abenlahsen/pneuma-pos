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
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|exists:sale_items,id',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'nullable|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.purchase_price' => 'numeric|min:0',
            'items.*.selling_price' => 'numeric|min:0',
            
            'date' => 'nullable|date',
            'with_invoice' => 'boolean',

            'city' => 'nullable|string|max:255',
            'carrier_id' => 'nullable|integer|exists:carriers,id',
            'tracking_number' => 'nullable|string|max:255',
            'partner_id' => 'nullable|integer|exists:partners,id',
            'service' => 'nullable|string|max:255',
            'service_fee' => 'nullable|numeric|min:0',
            'client' => 'nullable|string|max:255',
            'client_phone' => 'nullable|string|max:50',
            'payment_method' => 'nullable|string|max:255',
            'commercial_id' => 'required|integer|exists:users,id',
            'status' => 'nullable|string|max:255',
            'payment_status' => 'nullable|string|max:255',
            'delivery_date' => 'nullable|date',
            'comments' => 'nullable|string',
        ];
    }
}
