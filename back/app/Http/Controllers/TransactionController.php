<?php

namespace App\Http\Controllers;

use App\Domain\Transactions\TransactionService;
use App\Http\Requests\Transactions\StoreTransactionRequest;
use App\Http\Requests\Transactions\UpdateTransactionRequest;
use App\Http\Resources\Transactions\TransactionResource;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function __construct(private TransactionService $transactionService)
    {
    }

    /**
     * Display a paginated list of transactions with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $paginated = $this->transactionService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json(TransactionResource::collection($paginated)->resolve($request));
        }

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => TransactionResource::collection($paginated->items())->resolve($request),
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
     * Store a newly created transaction.
     */
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $transaction = $this->transactionService->create($request->validated(), $request->user());

        return response()->json((new TransactionResource($transaction))->resolve($request), 201);
    }

    /**
     * Display the specified transaction.
     */
    public function show(Transaction $transaction): JsonResponse
    {
        return response()->json((new TransactionResource($transaction->load('account')))->resolve(request()));
    }

    /**
     * Update the specified transaction.
     */
    public function update(UpdateTransactionRequest $request, Transaction $transaction): JsonResponse
    {
        $transaction = $this->transactionService->update(
            $transaction,
            $request->validated(),
            $request->user()->id,
            $request->user()->name,
        );

        return response()->json((new TransactionResource($transaction))->resolve($request));
    }

    /**
     * Remove the specified transaction.
     */
    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $this->transactionService->delete($transaction, $request->user()->id, $request->user()->name);

        return response()->json(null, 204);
    }

    /**
     * Get summary totals (income, expenses, balance) with optional filters.
     */
    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->transactionService->summary($request->all()));
    }

    /**
     * Get distinct values for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json($this->transactionService->filters());
    }
}
