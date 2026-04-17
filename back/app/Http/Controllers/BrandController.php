<?php

namespace App\Http\Controllers;

use App\Domain\Brands\BrandService;
use App\Http\Requests\Brands\StoreBrandRequest;
use App\Http\Requests\Brands\UpdateBrandRequest;
use App\Http\Resources\Brands\BrandResource;
use App\Models\Brand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    /**
     * @var BrandService
     */
    private $brandService;

    /**
     * @param BrandService $brandService
     */
    public function __construct(BrandService $brandService)
    {
        $this->brandService = $brandService;
    }
    
    public function index(Request $request): JsonResponse
    {
        $brands = $this->brandService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json(BrandResource::collection($brands)->resolve($request));
        }

        return response()->json([
            'current_page' => $brands->currentPage(),
            'data' => BrandResource::collection($brands->items())->resolve($request),
            'first_page_url' => $brands->url(1),
            'from' => $brands->firstItem(),
            'last_page' => $brands->lastPage(),
            'last_page_url' => $brands->url($brands->lastPage()),
            'links' => $brands->linkCollection()->toArray(),
            'next_page_url' => $brands->nextPageUrl(),
            'path' => $brands->path(),
            'per_page' => $brands->perPage(),
            'prev_page_url' => $brands->previousPageUrl(),
            'to' => $brands->lastItem(),
            'total' => $brands->total(),
        ]);
    }

    public function store(StoreBrandRequest $request): JsonResponse
    {
        $brand = $this->brandService->create(
            $request->validated(),
            $request->file('logo'),
        );

        return response()->json((new BrandResource($brand))->resolve($request), 201);
    }

    public function show(Brand $brand): JsonResponse
    {
        return response()->json((new BrandResource($brand))->resolve(request()));
    }

    public function update(UpdateBrandRequest $request, Brand $brand): JsonResponse
    {
        $brand = $this->brandService->update(
            $brand,
            $request->validated(),
            $request->file('logo'),
        );

        return response()->json((new BrandResource($brand))->resolve($request));
    }

    public function destroy(Brand $brand): JsonResponse
    {
        $this->brandService->delete($brand);

        return response()->json(null, 204);
    }

    public function toggleActive(Brand $brand): JsonResponse
    {
        $brand->update(['is_active' => !$brand->is_active]);

        return response()->json((new BrandResource($brand))->resolve(request()));
    }
}
