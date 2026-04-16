<?php

namespace App\Http\Controllers;

use App\Domain\Carriers\CarrierService;
use App\Http\Requests\Carriers\StoreCarrierRequest;
use App\Http\Requests\Carriers\UpdateCarrierRequest;
use App\Http\Resources\Carriers\CarrierResource;
use App\Models\Carrier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CarrierController extends Controller
{
    /**
     * @var CarrierService
     */
    private $carrierService;

    /**
     * @param CarrierService $carrierService
     */
    public function __construct(CarrierService $carrierService)
    {
        $this->carrierService = $carrierService;
    }
    
    public function index(Request $request): JsonResponse
    {
        $query = Carrier::query();

        $sortable = ['name', 'phone', 'email', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest('created_at');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('all')) {
            return response()->json(CarrierResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => CarrierResource::collection($paginated->items())->resolve($request),
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

    public function store(StoreCarrierRequest $request): JsonResponse
    {
        $carrier = $this->carrierService->create(
            $request->validated(),
            $request->user(),
        );

        return response()->json((new CarrierResource($carrier))->resolve($request), 201);
    }

    public function show(Carrier $carrier): JsonResponse
    {
        return response()->json((new CarrierResource($carrier))->resolve(request()));
    }

    public function update(UpdateCarrierRequest $request, Carrier $carrier): JsonResponse
    {
        $carrier = $this->carrierService->update($carrier, $request->validated());

        return response()->json((new CarrierResource($carrier))->resolve($request));
    }

    public function destroy(Carrier $carrier): JsonResponse
    {
        $this->carrierService->delete($carrier);

        return response()->json(null, 204);
    }
}