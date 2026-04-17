<?php

namespace App\Http\Controllers;

use App\Domain\Partners\PartnerService;
use App\Http\Requests\Partners\StorePartnerRequest;
use App\Http\Requests\Partners\UpdatePartnerRequest;
use App\Http\Resources\Partners\PartnerResource;
use App\Models\Partner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

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
        $partners = $this->partnerService->list($request->all());

        if (!($partners instanceof LengthAwarePaginator)) {
            return response()->json(PartnerResource::collection($partners)->resolve($request));
        }

        return response()->json([
            'current_page' => $partners->currentPage(),
            'data' => PartnerResource::collection($partners->items())->resolve($request),
            'first_page_url' => $partners->url(1),
            'from' => $partners->firstItem(),
            'last_page' => $partners->lastPage(),
            'last_page_url' => $partners->url($partners->lastPage()),
            'links' => $partners->linkCollection()->toArray(),
            'next_page_url' => $partners->nextPageUrl(),
            'path' => $partners->path(),
            'per_page' => $partners->perPage(),
            'prev_page_url' => $partners->previousPageUrl(),
            'to' => $partners->lastItem(),
            'total' => $partners->total(),
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