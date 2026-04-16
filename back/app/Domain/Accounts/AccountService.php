<?php

namespace App\Domain\Accounts;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AccountService
{
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
     * @param  Request  $request
     * @param  User  $user
     * @return JsonResponse
     */
    public function transfer($request, $user)
    {
        $validated = $request->validate([
            'source_account_id' => ['required', 'exists:accounts,id'],
            'destination_account_id' => ['required', 'exists:accounts,id', 'different:source_account_id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'date' => ['required', 'date'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

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