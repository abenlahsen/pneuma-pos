<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTransactionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'date' => ['sometimes', 'required', 'date'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0.01'],
            'type' => ['sometimes', 'required', 'in:income,expense'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['sometimes', 'required', 'string', 'max:1000'],
            'person' => ['nullable', 'string', 'max:100'],
            'partner' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Custom attribute names for error messages.
     */
    public function attributes(): array
    {
        return [
            'date' => 'date',
            'amount' => 'montant',
            'type' => 'type',
            'category' => 'catégorie',
            'description' => 'description',
            'person' => 'personne',
            'partner' => 'partenaire',
        ];
    }
}
