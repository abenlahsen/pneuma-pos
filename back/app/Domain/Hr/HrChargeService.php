<?php

namespace App\Domain\Hr;

use App\Domain\Transactions\TransactionService;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reads and writes are scoped to the confidential 'Charges RH' category tree
 * only — this service is not a general-purpose alternative entry point into
 * the Cash Flow module. Writes delegate to TransactionService::create() so
 * every HR-charge line is a real Transaction (it moves an account balance
 * and feeds the dashboard's net-margin KPI) and gets the same ActivityLog
 * entry as any other manually-entered transaction.
 */
class HrChargeService
{
    public function __construct(private TransactionService $transactionService) {}

    /**
     * @return array{transactions: Collection<int, Transaction>, start: Carbon, end: Carbon}
     */
    public function list(int $year, int $month, ?int $employeeId = null, ?string $subcategory = null): array
    {
        [$start, $end] = $this->monthBounds($year, $month);

        $query = Transaction::with(['account', 'employee'])
            ->where('type', 'expense')
            ->whereIn('category', $this->confidentialNames())
            ->dateBetween($start->toDateString(), $end->toDateString());

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        if ($subcategory) {
            $query->where('subcategory', $subcategory);
        }

        return [
            'transactions' => $query->orderBy('date')->orderBy('employee_id')->get(),
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(int $year, int $month, ?int $employeeId = null, ?string $subcategory = null): array
    {
        [$start, $end] = $this->monthBounds($year, $month);

        $query = Transaction::query()
            ->where('type', 'expense')
            ->whereIn('category', $this->confidentialNames())
            ->dateBetween($start->toDateString(), $end->toDateString());

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        if ($subcategory) {
            $query->where('subcategory', $subcategory);
        }

        $rows = $query->get(['subcategory', 'amount', 'employee_id']);

        $bySubcategory = $rows->groupBy('subcategory')
            ->map(fn (Collection $group) => round((float) $group->sum('amount'), 2))
            ->sortDesc();

        return [
            'total' => round((float) $rows->sum('amount'), 2),
            'by_subcategory' => $bySubcategory,
            'employee_count' => $rows->pluck('employee_id')->filter()->unique()->count(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     * @return EloquentCollection<int, Transaction>
     */
    public function createBatch(array $lines, User $user): EloquentCollection
    {
        $confidential = $this->confidentialNames();
        if ($confidential === []) {
            throw ValidationException::withMessages([
                'lines' => ["Aucune catégorie confidentielle n'est configurée. Contactez un administrateur."],
            ]);
        }
        $parentName = $confidential[0];

        return DB::transaction(function () use ($lines, $user, $parentName) {
            $created = new EloquentCollection;

            foreach ($lines as $line) {
                $employee = User::find($line['employee_id']);

                $transaction = $this->transactionService->create([
                    'date' => $line['date'],
                    'amount' => $line['amount'],
                    'type' => 'expense',
                    'category' => $parentName,
                    'subcategory' => $line['subcategory'],
                    'method' => $line['method'],
                    'person' => $employee?->name ?? 'Employé #'.$line['employee_id'],
                    'employee_id' => $line['employee_id'],
                    'account_id' => $line['account_id'],
                    'description' => $line['description'] ?: "{$line['subcategory']} — ".($employee?->name ?? 'Employé #'.$line['employee_id']),
                ], $user);

                $created->push($transaction);
            }

            return $created;
        });
    }

    public function update(Transaction $transaction, array $validated, ?int $userId, ?string $userName): Transaction
    {
        $this->guardIsHrCharge($transaction);

        // Keep the denormalized `person` field in sync so the Cash Flow table
        // (which displays `person`, not `employee_id`) never shows a stale name.
        if (array_key_exists('employee_id', $validated)) {
            $validated['person'] = User::find($validated['employee_id'])?->name ?? $validated['person'] ?? $transaction->person;
        }

        return $this->transactionService->update($transaction, $validated, $userId, $userName);
    }

    public function delete(Transaction $transaction, ?int $userId, ?string $userName): void
    {
        $this->guardIsHrCharge($transaction);

        $this->transactionService->delete($transaction, $userId, $userName);
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        $parent = TransactionCategory::topLevel()->where('is_confidential', true)->ofType('expense')->first();

        return [
            'employees' => User::orderBy('name')->get(['id', 'name', 'salary', 'prime_per_tyre']),
            'subcategories' => $parent ? $parent->children()->get(['id', 'name']) : collect(),
            'accounts' => Account::active()->orderBy('name')->get(['id', 'name', 'type']),
        ];
    }

    /**
     * The HR module must not become a back door for editing/deleting ordinary
     * Cash Flow transactions — only transactions already filed under a
     * confidential category may be touched through these endpoints.
     */
    private function guardIsHrCharge(Transaction $transaction): void
    {
        if (! in_array($transaction->category, $this->confidentialNames(), true)) {
            abort(404);
        }
    }

    /**
     * @return array<int, string>
     */
    private function confidentialNames(): array
    {
        return TransactionCategory::confidentialNames();
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function monthBounds(int $year, int $month): array
    {
        $start = Carbon::createFromDate($year, $month, 1)->startOfDay();

        return [$start, $start->copy()->endOfMonth()->endOfDay()];
    }
}
