<?php

namespace App\Http\Requests;

use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSaleRequest extends FormRequest
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
            'date' => ['sometimes', 'required', 'date'],
            'with_invoice' => ['sometimes', 'nullable', 'boolean'],
            'client' => ['sometimes', 'nullable', 'string'],
            'client_phone' => ['sometimes', 'nullable', 'string'],
            'client_id' => ['sometimes', 'nullable', 'exists:clients,id'],
            'vehicle_id' => ['sometimes', 'nullable', 'exists:vehicles,id'],
            'mileage' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'commercial_id' => ['sometimes', 'required', 'exists:users,id'],
            'carrier_id' => ['sometimes', 'nullable', 'exists:carriers,id'],
            'tracking_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'partner_id' => ['sometimes', 'nullable', 'exists:partners,id'],
            'service' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', Rule::in(SaleStatus::values())],
            'payment_status' => ['sometimes', 'nullable', Rule::in(SalePaymentStatus::values())],
            'delivery_date' => ['sometimes', 'nullable', 'date'],
            'comments' => ['sometimes', 'nullable', 'string'],
            'items' => ['sometimes', 'required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'exists:products,id'],
            'items.*.stock_id' => ['nullable', 'exists:stocks,id'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0.01'],
            'items.*.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.selling_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
