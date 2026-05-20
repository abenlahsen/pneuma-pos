<?php

namespace App\Http\Controllers;

use App\Domain\Purchases\PurchaseService;
use App\Models\Purchase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchaseService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $paginated = $this->purchaseService->list($request->all());

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
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'discount' => 'nullable|numeric|min:0|max:100',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => 'required|string|in:EN COURS,RECU,TERMINE,ANNULE,RETOUR',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->purchaseService->rejectServicePurchases($validated['items'])) {
            return response()->json($error, 422);
        }

        $purchase = $this->purchaseService->create($validated, $request->user()->id);

        return response()->json($purchase, 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return response()->json($this->purchaseService->loadRelations($purchase));
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        if ($purchase->status === 'TERMINE' && ! $request->user()->hasRole('Administrator')) {
            return response()->json(['message' => 'Cet achat est terminé et ne peut plus être modifié.'], 403);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'discount' => 'nullable|numeric|min:0|max:100',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => 'required|string|in:EN COURS,RECU,TERMINE,ANNULE,RETOUR',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->purchaseService->rejectServicePurchases($validated['items'])) {
            return response()->json($error, 422);
        }

        $purchase = $this->purchaseService->update($purchase, $validated, $request->user()->id);

        return response()->json($purchase);
    }

    public function destroy(Request $request, Purchase $purchase): JsonResponse
    {
        if ($purchase->status === 'TERMINE' && ! $request->user()->hasRole('Administrator')) {
            return response()->json(['message' => 'Cet achat est terminé et ne peut plus être supprimé.'], 403);
        }

        $this->purchaseService->delete($purchase, $request->user()?->id);

        return response()->json(null, 204);
    }

    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->purchaseService->summary($request->all()));
    }

    public function filters(): JsonResponse
    {
        return response()->json($this->purchaseService->filters());
    }
}
