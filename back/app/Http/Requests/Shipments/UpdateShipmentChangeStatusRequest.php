<?php

namespace App\Http\Requests\Shipments;

use App\Enums\ShipmentChangeStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShipmentChangeStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(ShipmentChangeStatus::values())],
            'carrier_response' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
