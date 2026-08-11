<?php

namespace App\Http\Requests\Hr;

use App\Models\TransactionCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHrChargeBatchRequest extends FormRequest
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
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.employee_id' => ['required', 'exists:users,id'],
            'lines.*.date' => ['required', 'date'],
            'lines.*.subcategory' => ['required', 'string', Rule::in($subcategoryIds)],
            'lines.*.amount' => ['required', 'numeric', 'min:0.01'],
            'lines.*.account_id' => ['required', 'exists:accounts,id'],
            'lines.*.method' => ['required', 'string'],
            'lines.*.description' => ['nullable', 'string'],
        ];
    }
}
