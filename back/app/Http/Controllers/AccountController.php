<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAccountRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AccountController extends Controller
{
    /**
     * List all accounts with their computed current_balance.
     */
    public function index(): JsonResponse
    {
        $accounts = Account::orderBy('name')->get();

        return response()->json($accounts);
    }

    /**
     * Show a single account.
     */
    public function show(Account $account): JsonResponse
    {
        return response()->json($account);
    }

    /**
     * Create a new account.
     */
    public function store(StoreAccountRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['initial_balance'] = $data['initial_balance'] ?? 0;

        $account = Account::create($data);

        return response()->json($account, 201);
    }

    /**
     * Update an existing account.
     */
    public function update(UpdateAccountRequest $request, Account $account): JsonResponse
    {
        $account->update($request->validated());

        return response()->json($account->fresh());
    }

    /**
     * Delete an account (only if it has no transactions).
     */
    public function destroy(Account $account): JsonResponse
    {
        if ($account->transactions()->exists()) {
            return response()->json([
                'message' => 'Impossible de supprimer ce compte car il contient des transactions.',
            ], 422);
        }

        $account->delete();

        return response()->json(null, 204);
    }

    /**
     * Transfer money between two accounts.
     * Creates two linked transactions with the same transfer_id.
     */
    public function transfer(Request $request): JsonResponse
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

        // Expense on source account
        $expense = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'expense',
            'category' => 'Transfert',
            'method' => 'Virement',
            'description' => $description,
            'person' => '',
            'partner' => '',
            'user_id' => $request->user()->id,
            'account_id' => $sourceAccount->id,
            'transfer_id' => $transferId,
        ]);

        // Income on destination account
        $income = Transaction::create([
            'date' => $validated['date'],
            'amount' => $validated['amount'],
            'type' => 'income',
            'category' => 'Transfert',
            'method' => 'Virement',
            'description' => $description,
            'person' => '',
            'partner' => '',
            'user_id' => $request->user()->id,
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
