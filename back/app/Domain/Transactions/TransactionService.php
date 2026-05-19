<?php

namespace App\Domain\Transactions;

use App\Models\Account;
use App\Models\Payment;
use App\Models\PurchasePayment;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class TransactionService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator|Collection
    {
        $query = $this->buildFilteredQuery($filters);

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function create(array $validated, User $user): Transaction
    {
        $transaction = Transaction::create(array_merge(
            $validated,
            ['user_id' => $user->id],
        ));

        return $transaction->load('account');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Transaction $transaction, array $validated): Transaction
    {
        $this->guardLinkedToCompleted($transaction);

        $transaction->update($validated);

        return $transaction->fresh()->load('account');
    }

    public function delete(Transaction $transaction): void
    {
        $this->guardLinkedToCompleted($transaction);

        $transaction->delete();
    }

    private function guardLinkedToCompleted(Transaction $transaction): void
    {
        $payment = Payment::where('transaction_id', $transaction->id)
            ->with('sale:id,payment_status')
            ->first();

        if ($payment?->sale?->payment_status === 'PAYÉ') {
            abort(422, "Cette transaction est liée à la vente #{$payment->sale_id} entièrement payée. Modifiez d'abord le statut de paiement de la vente.");
        }

        $purchasePayment = PurchasePayment::where('transaction_id', $transaction->id)
            ->with('purchase:id,payment_status')
            ->first();

        if ($purchasePayment?->purchase?->payment_status === 'PAYE') {
            abort(422, "Cette transaction est liée à l'achat #{$purchasePayment->purchase_id} entièrement payé. Modifiez d'abord le statut de paiement de l'achat.");
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, float>
     */
    public function summary(array $filters = []): array
    {
        $query = Transaction::query();

        if (! empty($filters['category'])) {
            $query->ofCategory($filters['category']);
        }

        $query->dateBetween($filters['date_from'] ?? null, $filters['date_to'] ?? null);

        if (! empty($filters['person'])) {
            $query->where('person', $filters['person']);
        }

        if (! empty($filters['account_id'])) {
            $query->where('account_id', $filters['account_id']);
        }

        $income = (clone $query)->settled()->ofType('income')->sum('amount');
        $expenses = (clone $query)->settled()->ofType('expense')->sum('amount');
        $pendingIncome = (clone $query)->pending()->ofType('income')->sum('amount');
        $pendingExpense = (clone $query)->pending()->ofType('expense')->sum('amount');
        $cashBalance = Account::where('type', 'cash')->get()->sum('current_balance');

        return [
            'income' => round((float) $income, 2),
            'expenses' => round((float) $expenses, 2),
            'balance' => round((float) $cashBalance, 2),
            'pending_income' => round((float) $pendingIncome, 2),
            'pending_expense' => round((float) $pendingExpense, 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        return [
            'categories' => Transaction::distinct()->whereNotNull('category')->pluck('category')->sort()->values(),
            'persons' => Transaction::distinct()->whereNotNull('person')->pluck('person')->sort()->values(),
            'partners' => Transaction::distinct()->whereNotNull('partner')->pluck('partner')->sort()->values(),
            'accounts' => Account::active()->orderBy('name')->get(['id', 'name', 'type']),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function buildFilteredQuery(array $filters): Builder
    {
        $query = Transaction::with('account');

        $sortable = ['date', 'amount', 'type', 'category', 'description', 'person', 'partner', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->latest('date');
        }

        if (! empty($filters['type'])) {
            $query->ofType($filters['type']);
        }

        if (! empty($filters['category'])) {
            $query->ofCategory($filters['category']);
        }

        $query->dateBetween($filters['date_from'] ?? null, $filters['date_to'] ?? null);

        if (! empty($filters['person'])) {
            $query->where('person', $filters['person']);
        }

        if (! empty($filters['partner'])) {
            $query->where('partner', $filters['partner']);
        }

        if (! empty($filters['account_id'])) {
            $query->where('account_id', $filters['account_id']);
        }

        if (! empty($filters['search'])) {
            $query->where('description', 'like', '%' . $filters['search'] . '%');
        }

        if (isset($filters['amount_min']) && $filters['amount_min'] !== '') {
            $query->where('amount', '>=', (float) $filters['amount_min']);
        }

        if (isset($filters['amount_max']) && $filters['amount_max'] !== '') {
            $query->where('amount', '<=', (float) $filters['amount_max']);
        }

        if (($filters['status'] ?? '') === 'pending') {
            $query->pending();
        } elseif (($filters['status'] ?? '') === 'settled') {
            $query->settled();
        }

        return $query;
    }
}
