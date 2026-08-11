<?php

namespace App\Http\Controllers;

use App\Domain\Hr\HrChargeService;
use App\Http\Requests\Hr\StoreHrChargeBatchRequest;
use App\Http\Requests\Hr\UpdateHrChargeRequest;
use App\Http\Resources\Hr\HrChargeResource;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class HrChargeController extends Controller
{
    public function __construct(protected HrChargeService $hrChargeService) {}

    public function index(Request $request): JsonResponse
    {
        $result = $this->hrChargeService->list(
            (int) $request->input('year', now()->year),
            (int) $request->input('month', now()->month),
            $request->filled('employee_id') ? (int) $request->input('employee_id') : null,
            $request->string('subcategory')->toString() ?: null,
        );

        return response()->json([
            'data' => HrChargeResource::collection($result['transactions'])->resolve(),
            'total' => $result['transactions']->count(),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->hrChargeService->summary(
            (int) $request->input('year', now()->year),
            (int) $request->input('month', now()->month),
            $request->filled('employee_id') ? (int) $request->input('employee_id') : null,
            $request->string('subcategory')->toString() ?: null,
        ));
    }

    public function filters(): JsonResponse
    {
        return response()->json($this->hrChargeService->filters());
    }

    public function store(StoreHrChargeBatchRequest $request): JsonResponse
    {
        $transactions = $this->hrChargeService->createBatch($request->validated()['lines'], $request->user());

        return response()->json(
            HrChargeResource::collection($transactions->load(['account', 'employee']))->resolve(),
            201
        );
    }

    public function update(UpdateHrChargeRequest $request, Transaction $transaction): JsonResponse
    {
        $updated = $this->hrChargeService->update(
            $transaction,
            $request->validated(),
            $request->user()->id,
            $request->user()->name,
        );

        return response()->json((new HrChargeResource($updated->load(['account', 'employee'])))->resolve());
    }

    public function destroy(Request $request, Transaction $transaction): Response
    {
        $this->hrChargeService->delete($transaction, $request->user()->id, $request->user()->name);

        return response()->noContent();
    }

    public function updateEmployee(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'salary' => ['nullable', 'numeric', 'min:0'],
            'cnss_number' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
        ]);

        $user->update($validated);

        return response()->json($user->only(['id', 'name', 'salary', 'cnss_number', 'hire_date']));
    }
}
