<?php

namespace App\Http\Requests\Shipments;

use App\Enums\ShipmentChangeField;
use App\Enums\ShipmentChangeStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShipmentChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'carrier_id' => ['nullable', 'exists:carriers,id'],
            'shipment_number' => ['nullable', 'string', 'max:255'],
            'date' => ['required', 'date'],
            'status' => ['nullable', Rule::in(ShipmentChangeStatus::values())],
            'reason' => ['nullable', 'string', 'max:2000'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.field' => ['required_with:items', Rule::in(ShipmentChangeField::values())],
            'items.*.custom_label' => ['nullable', 'required_if:items.*.field,other', 'string', 'max:255'],
            'items.*.old_value' => ['nullable', 'string', 'max:255'],
            'items.*.new_value' => ['required_with:items', 'string', 'max:255'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ];
    }
}
