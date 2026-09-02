<?php

namespace App\Http\Requests\Reporting;

use Illuminate\Foundation\Http\FormRequest;

class MonthlyReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'year' => ['sometimes', 'integer', 'min:2000', 'max:'.(now()->year + 1)],
            'month' => ['sometimes', 'integer', 'min:1', 'max:12'],
        ];
    }

    public function year(): int
    {
        return (int) ($this->validated('year') ?? now()->year);
    }

    public function month(): int
    {
        return (int) ($this->validated('month') ?? now()->month);
    }
}
