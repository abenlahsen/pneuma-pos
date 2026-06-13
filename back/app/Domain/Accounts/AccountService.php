<?php

namespace App\Domain\Accounts;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class AccountService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = [])
    {
        $today = now()->toDateString();

        $query = Account::query()->selectRaw("
            accounts.*,
            COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                WHERE t.account_id = accounts.id AND t.type = 'income'
                AND (t.method NOT IN ('Chèque','Effet') OR t.method IS NULL OR t.date <= ?)
            ), 0) AS settled_income,
            COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                WHERE t.account_id = accounts.id AND t.type = 'expense'
                AND (t.method NOT IN ('Chèque','Effet') OR t.method IS NULL OR t.date <= ?)
            ), 0) AS settled_expense,
            COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                WHERE t.account_id = accounts.id AND t.type = 'income'
                AND t.method IN ('Chèque','Effet') AND t.date > ?
            ), 0) AS pending_income,
            COALESCE((
                SELECT SUM(t.amount) FROM transactions t
                WHERE t.account_id = accounts.id AND t.type = 'expense'
                AND t.method IN ('Chèque','Effet') AND t.date > ?
            ), 0) AS pending_expense
        ", [$today, $today, $today, $today]);

        if (! empty($filters['search'])) {
            $query->where('name', 'like', '%' . $filters['search'] . '%');
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? $filters['is_active']);
        }

        $sortable = ['name', 'type', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->orderBy('name');
        }

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return Account
     */
    public function create($validated)
    {
        $validated['initial_balance'] = $validated['initial_balance'] ?? 0;

        return Account::create($validated);
    }

    /**
     * @param  Account  $account
     * @param  array<string, mixed>  $validated
     * @return Account
     */
    public function update($account, $validated)
    {
        $account->update($validated);

        return $account->fresh();
    }

    /**
     * @param  Account  $account
     * @return JsonResponse|null
     */
    public function delete($account)
    {
        if ($account->transactions()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer ce compte car il contient des transactions.',
            ], 422);
        }

        $account->delete();

        return null;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  User  $user
     * @return JsonResponse
     */
    public function transfer($validated, $user)
    {
        $transferId = Str::uuid()->toString();
        $sourceAccount = Account::findOrFail($validated['source_account_id']);
        $destAccount = Account::findOrFail($validated['destination_account_id']);

        $description = $validated['description']
            ?: "Transfert {$sourceAccount->name} → {$destAccount->name}";

        $expense = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'expense',
            'category' => 'Transfert',
            'method' => 'Virement',
            'description' => $description,
            'person' => '',
            'partner' => '',
            'user_id' => $user->id,
            'account_id' => $sourceAccount->id,
            'transfer_id' => $transferId,
        ]);

        $income = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Transfert',
            'method' => 'Virement',
            'description' => $description,
            'person' => '',
            'partner' => '',
            'user_id' => $user->id,
            'account_id' => $destAccount->id,
            'transfer_id' => $transferId,
        ]);

        return response()->json([
            'message' => 'Transfert effectué avec succès.',
            'transfer_id' => $transferId,
            'expense' => $expense->load('account'),
            'income' => $income->load('account'),
        ], 201);
    }
}
