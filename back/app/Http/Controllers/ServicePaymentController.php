<?php

namespace App\Http\Controllers;

use App\Domain\ServiceOrders\ServicePaymentService;
use App\Http\Requests\ServiceOrders\StoreServicePaymentRequest;
use App\Http\Resources\ServiceOrders\ServicePaymentResource;
use App\Models\ServiceOrder;
use App\Models\ServicePayment;
use Illuminate\Http\JsonResponse;

class ServicePaymentController extends Controller
{
    public function __construct(protected ServicePaymentService $servicePaymentService) {}

    public function index(ServiceOrder $serviceOrder): JsonResponse
    {
        return response()->json($this->servicePaymentService->listForOrder($serviceOrder));
    }

    public function store(StoreServicePaymentRequest $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $payment = $this->servicePaymentService->createPayment(
            $serviceOrder,
            $request->validated(),
            $request->user()
        );

        return response()->json((new ServicePaymentResource($payment))->resolve(), 201);
    }

    public function destroy(ServiceOrder $serviceOrder, ServicePayment $servicePayment): JsonResponse
    {
        $this->servicePaymentService->deletePayment($serviceOrder, $servicePayment);

        return response()->json(null, 204);
    }
}
