<?php

namespace App\Http\Requests\ServiceOrders;

use App\Enums\ServiceOrderPaymentStatus;
use App\Enums\ServiceOrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateServiceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['sometimes', 'required', 'date'],
            'vehicle_id' => ['nullable', 'exists:vehicles,id'],
            'vehicle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.item_type' => ['required_with:items', 'in:service,part'],
            'items.*.service_type' => ['nullable', 'string', 'max:255'],
            'items.*.product_id' => ['nullable', Rule::exists('products', 'id')],
            'items.*.stock_id' => ['nullable', Rule::exists('stocks', 'id')],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.parts_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.sort_order' => ['nullable', 'integer'],
            'discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in(ServiceOrderStatus::values())],
            'payment_status' => ['nullable', Rule::in(ServiceOrderPaymentStatus::values())],
            'notes' => ['nullable', 'string', 'max:2000'],
            'commercial_id' => ['sometimes', 'required', 'exists:users,id'],
            'client_id' => ['nullable', 'exists:clients,id'],
        ];
    }
}
