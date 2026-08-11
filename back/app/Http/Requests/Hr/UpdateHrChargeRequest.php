<?php

namespace App\Http\Requests\Hr;

use App\Models\TransactionCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateHrChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $subcategoryIds = TransactionCategory::topLevel()
            ->where('is_confidential', true)
            ->ofType('expense')
            ->with('children:id,parent_id,name')
            ->get()
            ->flatMap(fn ($parent) => $parent->children->pluck('name'));

        return [
            'employee_id' => ['sometimes', 'required', 'exists:users,id'],
            'date' => ['sometimes', 'required', 'date'],
            'subcategory' => ['sometimes', 'required', 'string', Rule::in($subcategoryIds)],
            'amount' => ['sometimes', 'required', 'numeric', 'min:0.01'],
            'account_id' => ['sometimes', 'required', 'exists:accounts,id'],
            'method' => ['sometimes', 'required', 'string'],
            'description' => ['nullable', 'string'],
        ];
    }
}
