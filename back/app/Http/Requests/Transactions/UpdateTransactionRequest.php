<?php

namespace App\Http\Requests\Transactions;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTransactionRequest extends FormRequest
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
            'account_id' => ['sometimes', 'required', 'exists:accounts,id'],
            'type' => ['sometimes', 'required', 'in:income,expense'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'date' => ['sometimes', 'required', 'date'],
            'category' => ['sometimes', 'required', 'string'],
            'method' => ['sometimes', 'required', 'string'],
            'person' => ['sometimes', 'required', 'string'],
            'description' => ['nullable', 'string'],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
