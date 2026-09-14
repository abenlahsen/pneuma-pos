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
            'quarter' => ['sometimes', 'integer', 'min:1', 'max:4'],
            'granularity' => ['sometimes', 'in:month,quarter,year'],
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

    /** @return 'month'|'quarter'|'year' */
    public function granularity(): string
    {
        return (string) ($this->validated('granularity') ?? 'month');
    }

    /** Mois, trimestre ou rien selon la granularite demandee. */
    public function unit(): int
    {
        return match ($this->granularity()) {
            'quarter' => (int) ($this->validated('quarter') ?? (int) ceil(now()->month / 3)),
            'year' => 1,
            default => $this->month(),
        };
    }
}
