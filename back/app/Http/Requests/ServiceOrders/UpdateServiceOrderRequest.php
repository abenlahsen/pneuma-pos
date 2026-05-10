<?php

namespace App\Http\Requests\ServiceOrders;

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
            'vehicle' => ['sometimes', 'required', 'string', 'max:255'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', Rule::exists('products', 'id')->where('type', 'service')],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.parts_cost' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['required_with:items', 'numeric', 'min:0'],
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
