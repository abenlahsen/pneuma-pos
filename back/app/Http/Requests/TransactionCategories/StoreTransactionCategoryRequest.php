<?php

namespace App\Http\Requests\TransactionCategories;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTransactionCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('transaction_categories', 'name')
                    ->where(fn ($query) => $query
                        ->where('type', $this->input('type'))
                        ->where('parent_id', $this->input('parent_id'))),
            ],
            'type' => ['required', 'in:income,expense'],
            'parent_id' => ['nullable', 'exists:transaction_categories,id'],
            'sort_order' => ['nullable', 'integer'],
            'counts_as_expense' => ['sometimes', 'boolean'],
        ];
    }
}
