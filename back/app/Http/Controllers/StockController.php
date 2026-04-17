<?php

namespace App\Http\Controllers;

use App\Domain\Stock\StockService;
use App\Models\Stock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StockController extends Controller
{
    /**
     * @var StockService
     */
    private $stockService;

    /**
     * @param StockService $stockService
     */
    public function __construct(StockService $stockService)
    {
        $this->stockService = $stockService;
    }

    public function index(Request $request): JsonResponse
    {
        $paginated = $this->stockService->list($request->all());

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

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'required|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
        ]);

        $user = $request->user();
        $stock = $this->stockService->create($validated, $user ? $user->id : null);

        return response()->json($stock, 201);
    }

    public function show(Stock $stock): JsonResponse
    {
        return response()->json($stock->load('product.brand', 'product.tyre'));
    }

    public function update(Request $request, Stock $stock): JsonResponse
    {
        $rules = [
            'product_id' => 'sometimes|exists:products,id',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'sometimes|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'reason' => 'nullable|string|max:1000',
        ];

        $before = (int) $stock->quantity;
        $quantityChanged = $request->has('quantity') && (int) $request->input('quantity') !== $before;

        if ($quantityChanged) {
            $rules['reason'] = 'required|string|min:3|max:1000';
        }

        $validated = $request->validate($rules);

        $user = $request->user();
        $stock = $this->stockService->update($stock, $validated, $user ? $user->id : null);

        return response()->json($stock);
    }

    public function destroy(Request $request, Stock $stock): JsonResponse
    {
        $user = $request->user();
        $this->stockService->delete($stock, $user ? $user->id : null);

        return response()->json(null, 204);
    }

    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->stockService->summary($request->all()));
    }

    public function filters(): JsonResponse
    {
        return response()->json($this->stockService->filters());
    }

    /**
     * @param Request $request
     * @return StreamedResponse
     */
    public function export(Request $request)
    {
        return $this->stockService->exportAvailable($request->all());
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:5120',
        ]);

        $user = $request->user();

        return response()->json(
            $this->stockService->import($request->file('file'), $user ? $user->id : null)
        );
    }

}
