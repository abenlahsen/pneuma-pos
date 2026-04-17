<?php

namespace App\Http\Controllers;

use App\Domain\Accounts\AccountService;
use App\Http\Requests\Accounts\StoreAccountRequest;
use App\Http\Requests\Accounts\TransferAccountRequest;
use App\Http\Requests\Accounts\UpdateAccountRequest;
use App\Http\Resources\Accounts\AccountResource;
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
    public function index(Request $request): JsonResponse
    {
        $paginated = $this->accountService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json(AccountResource::collection($paginated)->resolve($request));
        }

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => AccountResource::collection($paginated->items())->resolve($request),
            'first_page_url' => $paginated->url(1),
            'from' => $paginated->firstItem(),
            'last_page' => $paginated->lastPage(),
            'last_page_url' => $paginated->url($paginated->lastPage()),
            'links' => $paginated->linkCollection()->toArray(),
            'next_page_url' => $paginated->nextPageUrl(),
            'path' => $paginated->path(),
            'per_page' => $paginated->perPage(),
            'prev_page_url' => $paginated->previousPageUrl(),
            'to' => $paginated->lastItem(),
            'total' => $paginated->total(),
        ]);
    }

    /**
     * Show a single account.
     */
    public function show(Account $account): JsonResponse
    {
        return response()->json((new AccountResource($account))->resolve(request()));
    }

    /**
     * Create a new account.
     */
    public function store(StoreAccountRequest $request): JsonResponse
    {
        $account = $this->accountService->create($request->validated());

        return response()->json((new AccountResource($account))->resolve($request), 201);
    }

    /**
     * Update an existing account.
     */
    public function update(UpdateAccountRequest $request, Account $account): JsonResponse
    {
        $account = $this->accountService->update($account, $request->validated());

        return response()->json((new AccountResource($account))->resolve($request));
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
    public function transfer(TransferAccountRequest $request): JsonResponse
    {
        return $this->accountService->transfer($request->validated(), $request->user());
    }
}
