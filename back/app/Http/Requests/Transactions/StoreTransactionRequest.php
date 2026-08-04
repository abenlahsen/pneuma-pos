<?php

namespace App\Http\Requests\Transactions;

use App\Models\TransactionCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'category' => ['required', 'string', Rule::exists('transaction_categories', 'name')
                ->where(fn ($query) => $query
                    ->whereNull('parent_id')
                    ->where('type', $this->input('type'))
                    ->where('is_active', true))],
            'subcategory' => ['nullable', 'string', function ($attribute, $value, $fail) {
                if (! $value) {
                    return;
                }

                $parent = TransactionCategory::where('name', $this->input('category'))
                    ->whereNull('parent_id')
                    ->where('type', $this->input('type'))
                    ->first();

                $valid = $parent && TransactionCategory::where('name', $value)
                    ->where('parent_id', $parent->id)
                    ->where('is_active', true)
                    ->exists();

                if (! $valid) {
                    $fail("La sous-catégorie sélectionnée n'est pas valide pour cette catégorie.");
                }
            }],
            'method' => ['required', 'string'],
            'person' => ['required', 'string'],
            'partner_id' => ['nullable', 'exists:partners,id'],
            'description' => ['nullable', 'string'],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
