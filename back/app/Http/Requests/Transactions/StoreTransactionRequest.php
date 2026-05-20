<?php

namespace App\Http\Requests\Transactions;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
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
            'account_id' => ['required', 'exists:accounts,id'],
            'type' => ['required', 'in:income,expense'],
            'amount' => ['required', 'numeric', 'min:0'],
            'date' => ['required', 'date'],
            'category' => ['required', 'string'],
            'method' => ['required', 'string'],
            'person' => ['required', 'string'],
            'partner_id' => ['nullable', 'exists:partners,id'],
            'description' => ['nullable', 'string'],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
