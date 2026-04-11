<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', 'unique:accounts,name,' . $this->route('account')->id],
            'type' => ['required', 'in:cash,bank,person'],
            'description' => ['nullable', 'string', 'max:1000'],
            'initial_balance' => ['nullable', 'numeric'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nom',
            'type' => 'type',
            'description' => 'description',
            'initial_balance' => 'solde initial',
        ];
    }
}
