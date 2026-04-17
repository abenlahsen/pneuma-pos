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
        return response()->json($this->carrierService->list($request->all()));
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