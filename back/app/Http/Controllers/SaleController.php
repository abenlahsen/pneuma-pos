<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SaleService;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private SaleService $saleService)
    {
    }

    /**
     * Display a paginated list of sales with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $paginated = $this->saleService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json($paginated);
        }

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => $paginated->items(),
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
     * Store a newly created sale.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $stockValidationError = $this->saleService->validateStock($request->input('items', []));

        if ($stockValidationError !== null) {
            return response()->json($stockValidationError, 422);
        }

        $sale = $this->saleService->create($request->validated(), $request->user()->id);

        return response()->json($sale, 201);
    }

    /**
     * Display the specified sale.
     */
    public function show(Sale $sale): JsonResponse
    {
        return response()->json($this->saleService->loadRelations($sale));
    }

    /**
     * Update the specified sale.
     */
    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $stockValidationError = $this->saleService->validateStock($request->input('items', []));

        if ($stockValidationError !== null) {
            return response()->json($stockValidationError, 422);
        }

        $sale = $this->saleService->update($sale, $request->validated(), $request->user()->id);

        return response()->json($sale);
    }

    /**
     * Remove the specified sale.
     */
    public function destroy(Request $request, Sale $sale): JsonResponse
    {
        $this->saleService->delete($sale, $request->user()?->id);

        return response()->json(null, 204);
    }

    /**
     * Get summary KPIs (all fields are unfiltered snapshots).
     */
    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->saleService->summary());
    }

    /**
     * Get distinct values for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json($this->saleService->filters());
    }
}