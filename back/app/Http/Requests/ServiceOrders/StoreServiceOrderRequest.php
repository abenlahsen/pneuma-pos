<?php

namespace App\Http\Requests\ServiceOrders;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date'],
            'vehicle_id' => ['nullable', 'exists:vehicles,id'],
            'vehicle' => ['nullable', 'string', 'max:255', 'required_without:vehicle_id'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_type' => ['required', 'in:service,part'],
            'items.*.service_type' => ['nullable', 'string', 'max:255'],
            'items.*.product_id' => ['required_if:items.*.item_type,part', 'nullable', Rule::exists('products', 'id')],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.parts_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.sort_order' => ['nullable', 'integer'],
            'discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', 'in:EN COURS,TERMINE,ANNULE'],
            'payment_status' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'commercial_id' => ['nullable', 'exists:users,id'],
            'client_id' => ['nullable', 'exists:clients,id'],
        ];
    }
}
