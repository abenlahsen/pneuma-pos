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
        $query = Brand::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $sortable = ['name', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->orderBy('name');
        }

        if ($request->boolean('all')) {
            return response()->json(BrandResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => BrandResource::collection($paginated->items())->resolve($request),
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