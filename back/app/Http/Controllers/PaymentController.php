<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SalePaymentService;
use App\Http\Requests\StoreSalePaymentRequest;
use App\Http\Resources\SalePaymentResource;
use App\Models\Payment;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    private SalePaymentService $salePaymentService;

    public function __construct(SalePaymentService $salePaymentService)
    {
        $this->salePaymentService = $salePaymentService;
    }

    /**
     * List all payments for a sale.
     */
    public function index(Sale $sale): JsonResponse
    {
        return response()->json($this->salePaymentService->listForSale($sale));
    }

    /**
     * Store a new payment for a sale.
     * Always creates a Transaction (income) in the chosen account.
     */
    public function store(StoreSalePaymentRequest $request, Sale $sale): JsonResponse
    {
        $payment = $this->salePaymentService->createPayment($sale, $request->validated(), $request->user());

        return response()->json((new SalePaymentResource($payment))->resolve(), 201);
    }

    /**
     * Delete a payment and its linked transaction.
     */
    public function destroy(Sale $sale, Payment $payment): JsonResponse
    {
        $this->salePaymentService->deletePayment($sale, $payment);

        return response()->json(null, 204);
    }
}