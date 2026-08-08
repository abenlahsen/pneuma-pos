<?php

namespace App\Http\Controllers;

use App\Domain\Suppliers\SupplierService;
use App\Http\Requests\Suppliers\StoreSupplierRequest;
use App\Http\Requests\Suppliers\UpdateSupplierRequest;
use App\Http\Resources\Suppliers\SupplierProfileResource;
use App\Http\Resources\Suppliers\SupplierResource;
use App\Http\Resources\Suppliers\SupplierStatementResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    /**
     * @var SupplierService
     */
    private $supplierService;

    /**
     * @param SupplierService $supplierService
     */
    public function __construct(SupplierService $supplierService)
    {
        $this->supplierService = $supplierService;
    }
    
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $sortable = ['name', 'contact_person', 'phone', 'email', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest('created_at');
        }

        if ($request->boolean('all')) {
            return response()->json(SupplierResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => SupplierResource::collection($paginated->items())->resolve($request),
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

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = $this->supplierService->create(
            $request->validated(),
            $request->user(),
        );

        return response()->json((new SupplierResource($supplier))->resolve($request), 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json((new SupplierResource($supplier))->resolve(request()));
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier = $this->supplierService->update($supplier, $request->validated());

        return response()->json((new SupplierResource($supplier))->resolve($request));
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $this->supplierService->delete($supplier);

        return response()->json(null, 204);
    }

    public function summary(): JsonResponse
    {
        return response()->json($this->supplierService->unpaidBySupplier());
    }

    public function profile(Supplier $supplier): JsonResponse
    {
        return response()->json(
            (new SupplierProfileResource($this->supplierService->getProfile($supplier)))->resolve(request())
        );
    }

    public function statement(Supplier $supplier): JsonResponse
    {
        return response()->json(
            (new SupplierStatementResource($this->supplierService->getStatement($supplier)))->resolve(request())
        );
    }
}