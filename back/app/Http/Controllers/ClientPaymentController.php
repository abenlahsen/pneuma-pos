<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SalePaymentService;
use App\Models\Client;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ClientPaymentController extends Controller
{
    public function __construct(private SalePaymentService $salePaymentService) {}

    public function unpaidSales(Client $client): JsonResponse
    {
        return response()->json([
            'sales' => $this->salePaymentService->unpaidSalesForClient($client),
        ]);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string|max:50',
            'date' => 'required|date',
            'account_id' => 'required|exists:accounts,id',
            'reference' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
            'allocations' => 'required|array|min:1',
            'allocations.*.sale_id' => 'required|exists:sales,id',
            'allocations.*.amount' => 'required|numeric|min:0.01',
        ]);

        $payment = $this->salePaymentService->createClientPayment($client, $validated, Auth::user());

        return response()->json($payment, 201);
    }

    public function destroy(Request $request, Client $client, Payment $payment): JsonResponse
    {
        $this->salePaymentService->deleteClientPayment(
            $client,
            $payment,
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json(null, 204);
    }
}
