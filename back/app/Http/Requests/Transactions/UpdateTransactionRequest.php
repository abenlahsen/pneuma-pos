<?php

namespace App\Http\Requests\Transactions;

use App\Models\TransactionCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
        $type = $this->input('type', $this->route('transaction')?->type);

        return [
            'account_id' => ['sometimes', 'required', 'exists:accounts,id'],
            'type' => ['sometimes', 'required', 'in:income,expense'],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0'],
            'date' => ['sometimes', 'required', 'date'],
            'category' => ['sometimes', 'required', 'string', Rule::exists('transaction_categories', 'name')
                ->where(fn ($query) => $query
                    ->whereNull('parent_id')
                    ->where('type', $type)
                    ->where('is_active', true))],
            'subcategory' => ['nullable', 'string', function ($attribute, $value, $fail) use ($type) {
                if (! $value) {
                    return;
                }

                $categoryName = $this->input('category', $this->route('transaction')?->category);

                $parent = TransactionCategory::where('name', $categoryName)
                    ->whereNull('parent_id')
                    ->where('type', $type)
                    ->first();

                $valid = $parent && TransactionCategory::where('name', $value)
                    ->where('parent_id', $parent->id)
                    ->where('is_active', true)
                    ->exists();

                if (! $valid) {
                    $fail("La sous-catégorie sélectionnée n'est pas valide pour cette catégorie.");
                }
            }],
            'method' => ['sometimes', 'required', 'string'],
            'person' => ['sometimes', 'required', 'string'],
            'partner_id' => ['nullable', 'exists:partners,id'],
            'description' => ['nullable', 'string'],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
