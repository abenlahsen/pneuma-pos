<?php

namespace App\Http\Controllers;

use App\Domain\Purchases\PurchasePaymentService;
use App\Models\PurchasePayment;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SupplierPaymentController extends Controller
{
    public function __construct(private PurchasePaymentService $purchasePaymentService) {}

    public function unpaidPurchases(Supplier $supplier): JsonResponse
    {
        return response()->json([
            'purchases' => $this->purchasePaymentService->unpaidPurchasesForSupplier($supplier),
        ]);
    }

    public function store(Request $request, Supplier $supplier): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string|max:50',
            'date' => 'required|date',
            'account_id' => 'required|exists:accounts,id',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'allocations' => 'required|array|min:1',
            'allocations.*.purchase_id' => 'required|exists:purchases,id',
            'allocations.*.amount' => 'required|numeric|min:0.01',
        ]);

        $payment = $this->purchasePaymentService->createSupplierPayment($supplier, $validated, Auth::user());

        return response()->json($payment, 201);
    }

    public function destroy(Request $request, Supplier $supplier, PurchasePayment $payment): JsonResponse
    {
        $this->purchasePaymentService->deleteSupplierPayment(
            $supplier,
            $payment,
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json(null, 204);
    }
}
