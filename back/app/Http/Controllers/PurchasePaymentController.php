<?php

namespace App\Http\Controllers;

use App\Domain\Purchases\PurchasePaymentService;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PurchasePaymentController extends Controller
{
    protected $purchasePaymentService;

    public function __construct(PurchasePaymentService $purchasePaymentService)
    {
        $this->purchasePaymentService = $purchasePaymentService;
    }

    public function index(Purchase $purchase): JsonResponse
    {
        return response()->json($this->purchasePaymentService->listForPurchase($purchase));
    }

    public function show(PurchasePayment $payment): JsonResponse
    {
        return response()->json($this->purchasePaymentService->getPaymentDetail($payment));
    }

    public function store(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string|max:50',
            'date' => 'required|date',
            'account_id' => 'required|exists:accounts,id',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
        ]);

        $payment = $this->purchasePaymentService->createPayment($purchase, $validated, Auth::user());

        return response()->json($payment, 201);
    }

    public function destroy(Request $request, Purchase $purchase, PurchasePayment $payment): JsonResponse
    {
        $this->purchasePaymentService->deletePayment(
            $purchase,
            $payment,
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json(null, 204);
    }
}
