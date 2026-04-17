<?php

namespace App\Http\Controllers;

use App\Domain\Products\ProductService;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Http\Resources\Products\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private ProductService $productService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $paginated = $this->productService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json(ProductResource::collection($paginated)->resolve($request));
        }

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => ProductResource::collection($paginated->items())->resolve($request),
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

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = $this->productService->create(
            $request->validated(),
            $request->user()?->id,
        );

        return response()->json((new ProductResource($product))->resolve($request), 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json((new ProductResource($this->productService->loadRelations($product)))->resolve(request()));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product = $this->productService->update($product, $request->validated());

        return response()->json((new ProductResource($product))->resolve($request));
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->productService->delete($product);

        return response()->json(null, 204);
    }

    public function toggleActive(Product $product): JsonResponse
    {
        return response()->json((new ProductResource($this->productService->toggleActive($product)))->resolve(request()));
    }

    public function filters(): JsonResponse
    {
        return response()->json($this->productService->filters());
    }

}
