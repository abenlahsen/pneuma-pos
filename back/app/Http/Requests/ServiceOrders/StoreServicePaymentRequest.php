<?php

namespace App\Http\Requests\ServiceOrders;

use Illuminate\Foundation\Http\FormRequest;

class StoreServicePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'date' => ['required', 'date'],
            'method' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'account_id' => ['nullable', 'exists:accounts,id'],
        ];
    }
}
