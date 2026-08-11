<?php

namespace App\Http\Requests\TransactionCategories;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTransactionCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $category = $this->route('transactionCategory');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('transaction_categories', 'name')
                    ->ignore($category)
                    ->where(fn ($query) => $query
                        ->where('type', $this->input('type', $category?->type))
                        ->where('parent_id', $this->input('parent_id', $category?->parent_id))),
            ],
            'type' => ['sometimes', 'required', 'in:income,expense'],
            'parent_id' => ['sometimes', 'nullable', 'exists:transaction_categories,id'],
            'sort_order' => ['nullable', 'integer'],
            'counts_as_expense' => ['sometimes', 'boolean'],
            'counts_as_revenue' => ['sometimes', 'boolean'],
            'is_confidential' => ['sometimes', 'boolean'],
        ];
    }
}
