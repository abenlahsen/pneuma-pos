<?php

namespace App\Http\Requests\ServiceOrders;

use Illuminate\Foundation\Http\FormRequest;

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
            'client' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'vehicle' => ['required', 'string', 'max:255'],
            'mileage' => ['nullable', 'integer', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.service_type' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.parts_cost' => ['required', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['required', 'numeric', 'min:0'],
            'items.*.sort_order' => ['nullable', 'integer'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'in:EN COURS,TERMINE,ANNULE'],
            'payment_status' => ['nullable', 'string'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'commercial_id' => ['nullable', 'exists:users,id'],
        ];
    }
}
