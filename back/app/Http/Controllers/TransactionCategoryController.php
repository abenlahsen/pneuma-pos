<?php

namespace App\Http\Controllers;

use App\Domain\TransactionCategories\TransactionCategoryService;
use App\Http\Requests\TransactionCategories\StoreTransactionCategoryRequest;
use App\Http\Requests\TransactionCategories\UpdateTransactionCategoryRequest;
use App\Http\Resources\TransactionCategories\TransactionCategoryResource;
use App\Models\TransactionCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TransactionCategoryController extends Controller
{
    public function __construct(protected TransactionCategoryService $transactionCategoryService) {}

    public function index(Request $request): JsonResponse
    {
        $categories = $this->transactionCategoryService->list(
            $request->string('type')->toString() ?: null,
            $request->boolean('only_active'),
            (bool) $request->user()?->can('view hr-charges'),
        );

        return response()->json([
            'data' => TransactionCategoryResource::collection($categories)->resolve(),
        ]);
    }

    public function store(StoreTransactionCategoryRequest $request): JsonResponse
    {
        $category = $this->transactionCategoryService->create($request->validated());

        return response()->json(
            (new TransactionCategoryResource($category))->resolve(),
            201
        );
    }

    public function update(UpdateTransactionCategoryRequest $request, TransactionCategory $transactionCategory): JsonResponse
    {
        $category = $this->transactionCategoryService->update($transactionCategory, $request->validated());

        return response()->json(
            (new TransactionCategoryResource($category))->resolve()
        );
    }

    public function destroy(TransactionCategory $transactionCategory): Response
    {
        $this->transactionCategoryService->delete($transactionCategory);

        return response()->noContent();
    }
}
