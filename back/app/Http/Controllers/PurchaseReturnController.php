<?php

namespace App\Http\Controllers;

use App\Domain\Purchases\PurchaseReturnService;
use App\Models\Purchase;
use App\Models\PurchaseReturn;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseReturnController extends Controller
{
    public function __construct(private PurchaseReturnService $returnService) {}

    public function index(Purchase $purchase): JsonResponse
    {
        return response()->json($this->returnService->listForPurchase($purchase));
    }

    public function store(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'reason' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.purchase_item_id' => 'required|integer|exists:purchase_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'refund' => 'nullable|array',
            'refund.amount' => 'required_with:refund|numeric|min:0.01',
            'refund.account_id' => 'required_with:refund|exists:accounts,id',
            'refund.date' => 'required_with:refund|date',
            'refund.method' => 'required_with:refund|string|max:50',
        ]);

        $return = $this->returnService->create($purchase, $validated, $request->user());

        return response()->json($return, 201);
    }

    public function destroy(Request $request, PurchaseReturn $purchaseReturn): JsonResponse
    {
        $this->returnService->delete($purchaseReturn, $request->user()?->id, $request->user()?->name);

        return response()->json(null, 204);
    }
}
