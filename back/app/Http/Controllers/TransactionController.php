<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTransactionRequest;
use App\Http\Requests\UpdateTransactionRequest;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    /**
     * Display a paginated list of transactions with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Transaction::with('account');

        // Sorting
        $sortable = ['date', 'amount', 'type', 'category', 'description', 'person', 'partner', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest('date');
        }

        // Filter by type
        if ($request->filled('type')) {
            $query->ofType($request->type);
        }

        // Filter by category
        if ($request->filled('category')) {
            $query->ofCategory($request->category);
        }

        // Filter by date range
        $query->dateBetween($request->date_from, $request->date_to);

        // Filter by person
        if ($request->filled('person')) {
            $query->where('person', $request->person);
        }

        // Filter by account
        if ($request->filled('account_id')) {
            $query->where('account_id', $request->account_id);
        }

        // Search in description
        if ($request->filled('search')) {
            $query->where('description', 'like', '%' . $request->search . '%');
        }

        $transactions = $query->paginate($request->get('per_page', 20));

        return response()->json($transactions);
    }

    /**
     * Store a newly created transaction.
     */
    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $transaction = Transaction::create(array_merge(
            $request->validated(),
            ['user_id' => $request->user()->id],
        ));

        return response()->json($transaction->load('account'), 201);
    }

    /**
     * Display the specified transaction.
     */
    public function show(Transaction $transaction): JsonResponse
    {
        return response()->json($transaction->load('account'));
    }

    /**
     * Update the specified transaction.
     */
    public function update(UpdateTransactionRequest $request, Transaction $transaction): JsonResponse
    {
        $transaction->update($request->validated());

        return response()->json($transaction->fresh()->load('account'));
    }

    /**
     * Remove the specified transaction.
     */
    public function destroy(Transaction $transaction): JsonResponse
    {
        $transaction->delete();

        return response()->json(null, 204);
    }

    /**
     * Get summary totals (income, expenses, balance) with optional filters.
     */
    public function summary(Request $request): JsonResponse
    {
        $query = Transaction::query();

        // Apply same filters as index
        if ($request->filled('category')) {
            $query->ofCategory($request->category);
        }
        $query->dateBetween($request->date_from, $request->date_to);
        if ($request->filled('person')) {
            $query->where('person', $request->person);
        }
        if ($request->filled('account_id')) {
            $query->where('account_id', $request->account_id);
        }

        $income = (clone $query)->settled()->ofType('income')->sum('amount');
        $expenses = (clone $query)->settled()->ofType('expense')->sum('amount');
        $pendingIncome = (clone $query)->pending()->ofType('income')->sum('amount');
        $pendingExpense = (clone $query)->pending()->ofType('expense')->sum('amount');

        // Solde = cash accounts only (includes initial balances, excludes pending)
        $cashBalance = Account::where('type', 'cash')->get()->sum('current_balance');

        return response()->json([
            'income' => round($income, 2),
            'expenses' => round($expenses, 2),
            'balance' => round($cashBalance, 2),
            'pending_income' => round($pendingIncome, 2),
            'pending_expense' => round($pendingExpense, 2),
        ]);
    }

    /**
     * Get distinct values for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json([
            'categories' => Transaction::distinct()->whereNotNull('category')->pluck('category')->sort()->values(),
            'persons' => Transaction::distinct()->whereNotNull('person')->pluck('person')->sort()->values(),
            'partners' => Transaction::distinct()->whereNotNull('partner')->pluck('partner')->sort()->values(),
            'accounts' => Account::active()->orderBy('name')->get(['id', 'name', 'type']),
        ]);
    }
}
