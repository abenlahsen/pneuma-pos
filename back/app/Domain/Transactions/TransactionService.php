<?php

namespace App\Domain\Transactions;

use App\Enums\PurchasePaymentStatus;
use App\Enums\SalePaymentStatus;
use App\Models\Account;
use App\Models\Partner;
use App\Models\Payment;
use App\Models\PurchasePayment;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class TransactionService
{
    public function __construct(private ActivityLogService $activityLog) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator|Collection
    {
        $query = $this->buildFilteredQuery($filters);

        if (! empty($filters['all'])) {
            $results = $query->get();
            $this->attachPurchasePaymentIds($results);
            $this->attachSalePaymentIds($results);

            return $results;
        }

        $paginated = $query->paginate((int) ($filters['per_page'] ?? 20));
        $this->attachPurchasePaymentIds($paginated->getCollection());
        $this->attachSalePaymentIds($paginated->getCollection());

        return $paginated;
    }

    /**
     * Tag each transaction with the id of the PurchasePayment it settles (if any),
     * so the frontend can offer a "view payment" link — one bulk query, no N+1.
     */
    private function attachPurchasePaymentIds(Collection $transactions): void
    {
        $transactionIds = $transactions->pluck('id');
        if ($transactionIds->isEmpty()) {
            return;
        }

        $map = PurchasePayment::whereIn('transaction_id', $transactionIds)->pluck('id', 'transaction_id');

        $transactions->each(function (Transaction $transaction) use ($map) {
            $transaction->purchase_payment_id = $map[$transaction->id] ?? null;
        });
    }

    /**
     * Tag each transaction with the id of the (sale) Payment it settles (if any),
     * so the frontend can offer a "view payment" link — one bulk query, no N+1.
     */
    private function attachSalePaymentIds(Collection $transactions): void
    {
        $transactionIds = $transactions->pluck('id');
        if ($transactionIds->isEmpty()) {
            return;
        }

        $map = Payment::whereIn('transaction_id', $transactionIds)->pluck('id', 'transaction_id');

        $transactions->each(function (Transaction $transaction) use ($map) {
            $transaction->sale_payment_id = $map[$transaction->id] ?? null;
        });
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

        $transaction->load('account');

        $snapshot = $this->activityLog->buildTransactionSnapshot($transaction);
        $this->activityLog->logTransactionCreated($transaction, $snapshot, $user->id, $user->name);

        return $transaction;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Transaction $transaction, array $validated, ?int $userId = null, ?string $userName = null): Transaction
    {
        $this->guardLinkedToCompleted($transaction);

        $transaction->load('account');
        $before = $this->activityLog->buildTransactionSnapshot($transaction);

        $transaction->update($validated);
        $fresh = $transaction->fresh()->load('account');

        $after = $this->activityLog->buildTransactionSnapshot($fresh);
        $this->activityLog->logTransactionUpdated($fresh, $before, $after, $userId, $userName);

        return $fresh;
    }

    public function delete(Transaction $transaction, ?int $userId = null, ?string $userName = null): void
    {
        $this->guardLinkedToCompleted($transaction);

        $transaction->load('account');
        $before = array_merge(['id' => $transaction->id], $this->activityLog->buildTransactionSnapshot($transaction));

        $transaction->delete();

        $this->activityLog->logTransactionDeleted($before, $userId, $userName);
    }

    private function guardLinkedToCompleted(Transaction $transaction): void
    {
        $payment = Payment::where('transaction_id', $transaction->id)
            ->with('allocations.sale:id,payment_status')
            ->first();

        $completedSaleAllocation = $payment?->allocations
            ->first(fn ($allocation) => $allocation->sale?->payment_status === SalePaymentStatus::PAYE->value);

        if ($completedSaleAllocation) {
            abort(422, "Cette transaction est liée à la vente #{$completedSaleAllocation->sale_id} entièrement payée. Modifiez d'abord le statut de paiement de la vente.");
        }

        $purchasePayment = PurchasePayment::where('transaction_id', $transaction->id)
            ->with('allocations.purchase:id,payment_status')
            ->first();

        $completedAllocation = $purchasePayment?->allocations
            ->first(fn ($allocation) => $allocation->purchase?->payment_status === PurchasePaymentStatus::PAYE->value);

        if ($completedAllocation) {
            abort(422, "Cette transaction est liée à l'achat #{$completedAllocation->purchase_id} entièrement payé. Modifiez d'abord le statut de paiement de l'achat.");
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
            'partners' => Partner::orderBy('name')->get(['id', 'name']),
            'accounts' => Account::active()->orderBy('name')->get(['id', 'name', 'type']),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function buildFilteredQuery(array $filters): Builder
    {
        $query = Transaction::with('account', 'partner');

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

        if (! empty($filters['partner_id'])) {
            $query->where('partner_id', (int) $filters['partner_id']);
        }

        if (! empty($filters['account_id'])) {
            $query->where('account_id', $filters['account_id']);
        }

        if (! empty($filters['search'])) {
            $query->where('description', 'like', '%'.$filters['search'].'%');
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
