<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    /**
     * Display a paginated list of sales with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()->latest('date');

        // Filter by text search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('client', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%")
                  ->orWhere('dimension', 'like', "%{$search}%")
                  ->orWhere('comments', 'like', "%{$search}%");
            });
        }

        // Filter by exact fields
        $fields = ['brand', 'city', 'client', 'payment_method', 'status', 'payment_status'];
        foreach ($fields as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->$field);
            }
        }

        // Filter by partner relationship
        if ($request->filled('partner')) {
            $query->whereHas('partner', function($q) use ($request) {
                $q->where('name', $request->partner);
            });
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        $sales = $query->paginate($request->get('per_page', 20));

        return response()->json($sales);
    }

    /**
     * Store a newly created sale.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $sale = Sale::create(array_merge(
            $request->validated(),
            ['user_id' => $request->user()->id],
        ));

        return response()->json($sale, 201);
    }

    /**
     * Display the specified sale.
     */
    public function show(Sale $sale): JsonResponse
    {
        return response()->json($sale);
    }

    /**
     * Update the specified sale.
     */
    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $sale->update($request->validated());

        return response()->json($sale);
    }

    /**
     * Remove the specified sale.
     */
    public function destroy(Sale $sale): JsonResponse
    {
        $sale->delete();

        return response()->json(null, 204);
    }

    /**
     * Get summary totals with optional filters.
     */
    public function summary(Request $request): JsonResponse
    {
        $query = Sale::query();

        // Apply same filters as index
        // Filter by exact fields
        $fields = ['brand', 'city', 'client', 'payment_method', 'status', 'payment_status'];
        foreach ($fields as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->$field);
            }
        }

        if ($request->filled('partner')) {
            $query->whereHas('partner', function($q) use ($request) {
                $q->where('name', $request->partner);
            });
        }

        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        $totalPurchase = (clone $query)->sum('total_purchase');
        $totalSale = (clone $query)->sum('total_sale');

        return response()->json([
            'total_purchase' => round($totalPurchase, 2),
            'total_sale' => round($totalSale, 2),
            'margin' => round($totalSale - $totalPurchase, 2),
        ]);
    }

    /**
     * Get distinct values for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json([
            'brands' => Sale::distinct()->whereNotNull('brand')->pluck('brand')->sort()->values(),
            'clients' => Sale::distinct()->whereNotNull('client')->pluck('client')->sort()->values(),
            'cities' => Sale::distinct()->whereNotNull('city')->pluck('city')->sort()->values(),
            'statuses' => Sale::distinct()->whereNotNull('status')->pluck('status')->sort()->values(),
            'payment_statuses' => Sale::distinct()->whereNotNull('payment_status')->pluck('payment_status')->sort()->values(),
            'partners' => \App\Models\Partner::pluck('name')->sort()->values(),
        ]);
    }
}
