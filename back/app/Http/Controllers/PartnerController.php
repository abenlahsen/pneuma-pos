<?php

namespace App\Http\Controllers;

use App\Domain\Partners\PartnerService;
use App\Http\Requests\Partners\StorePartnerRequest;
use App\Http\Requests\Partners\UpdatePartnerRequest;
use App\Http\Resources\Partners\PartnerResource;
use App\Models\Partner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PartnerController extends Controller
{
    /**
     * @var PartnerService
     */
    private $partnerService;

    /**
     * @param PartnerService $partnerService
     */
    public function __construct(PartnerService $partnerService)
    {
        $this->partnerService = $partnerService;
    }
    
    public function index(Request $request): JsonResponse
    {
        $query = Partner::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%");
            });
        }

        $sortable = ['name', 'city', 'phone', 'mobile', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest('created_at');
        }

        if ($request->boolean('all')) {
            return response()->json(PartnerResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => PartnerResource::collection($paginated->items())->resolve($request),
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

    public function store(StorePartnerRequest $request): JsonResponse
    {
        $partner = $this->partnerService->create(
            $request->validated(),
            $request->user(),
        );

        return response()->json((new PartnerResource($partner))->resolve($request), 201);
    }

    public function show(Partner $partner): JsonResponse
    {
        return response()->json((new PartnerResource($partner))->resolve(request()));
    }

    public function update(UpdatePartnerRequest $request, Partner $partner): JsonResponse
    {
        $partner = $this->partnerService->update($partner, $request->validated());

        return response()->json((new PartnerResource($partner))->resolve($request));
    }

    public function destroy(Partner $partner): JsonResponse
    {
        $this->partnerService->delete($partner);

        return response()->json(null, 204);
    }
}