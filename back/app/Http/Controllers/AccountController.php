<?php

namespace App\Http\Controllers;

use App\Domain\Accounts\AccountService;
use App\Http\Requests\StoreAccountRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    /**
     * @var AccountService
     */
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }
    
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
        $account = $this->accountService->create($request->validated());

        return response()->json($account, 201);
    }

    /**
     * Update an existing account.
     */
    public function update(UpdateAccountRequest $request, Account $account): JsonResponse
    {
        $account = $this->accountService->update($account, $request->validated());

        return response()->json($account);
    }

    /**
     * Delete an account (only if it has no transactions).
     */
    public function destroy(Account $account): JsonResponse
    {
        $response = $this->accountService->delete($account);

        if ($response instanceof JsonResponse) {
            return $response;
        }

        return response()->json(null, 204);
    }

    /**
     * Transfer money between two accounts.
     * Creates two linked transactions with the same transfer_id.
     */
    public function transfer(Request $request): JsonResponse
    {
        return $this->accountService->transfer($request, $request->user());
    }
}