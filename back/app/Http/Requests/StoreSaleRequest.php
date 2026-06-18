<?php

namespace App\Http\Requests;

use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'with_invoice' => ['nullable', 'boolean'],
            'client' => ['nullable', 'string'],
            'client_phone' => ['nullable', 'string'],
            'client_id' => ['nullable', 'exists:clients,id'],
            'vehicle_id' => ['nullable', 'exists:vehicles,id'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'commercial_id' => ['required', 'exists:users,id'],
            'carrier_id' => ['nullable', 'exists:carriers,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'partner_id' => ['required', 'exists:partners,id'],
            'service' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(SaleStatus::values())],
            'payment_status' => ['nullable', Rule::in(SalePaymentStatus::values())],
            'payment_method' => ['required', 'string'],
            'delivery_date' => ['nullable', 'date'],
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
