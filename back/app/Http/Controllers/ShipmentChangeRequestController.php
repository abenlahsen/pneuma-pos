<?php

namespace App\Http\Controllers;

use App\Domain\Shipments\ShipmentChangeService;
use App\Http\Requests\Shipments\StoreShipmentChangeRequest;
use App\Http\Requests\Shipments\UpdateShipmentChangeRequest;
use App\Http\Requests\Shipments\UpdateShipmentChangeStatusRequest;
use App\Http\Resources\Shipments\ShipmentChangeRequestResource;
use App\Models\Sale;
use App\Models\ShipmentChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ShipmentChangeRequestController extends Controller
{
    public function __construct(protected ShipmentChangeService $shipmentChangeService) {}

    public function index(Request $request): JsonResponse
    {
        $result = $this->shipmentChangeService->list($request->all());

        return response()->json([
            'data' => ShipmentChangeRequestResource::collection($result['data'])->resolve(),
            'total' => $result['total'],
            'current_page' => $result['current_page'],
            'last_page' => $result['last_page'],
            'per_page' => $result['per_page'],
        ]);
    }

    public function forSale(Sale $sale): JsonResponse
    {
        $requests = $this->shipmentChangeService->listForSale($sale);

        return response()->json([
            'data' => ShipmentChangeRequestResource::collection($requests)->resolve(),
        ]);
    }

    public function store(StoreShipmentChangeRequest $request, Sale $sale): JsonResponse
    {
        $shipmentChangeRequest = $this->shipmentChangeService->create($sale, $request->validated(), $request->user()?->id);

        return response()->json(
            (new ShipmentChangeRequestResource($shipmentChangeRequest))->resolve(),
            201
        );
    }

    public function show(ShipmentChangeRequest $shipmentChangeRequest): JsonResponse
    {
        $shipmentChangeRequest->load(['sale', 'carrier', 'items']);

        return response()->json(
            (new ShipmentChangeRequestResource($shipmentChangeRequest))->resolve()
        );
    }

    public function update(UpdateShipmentChangeRequest $request, ShipmentChangeRequest $shipmentChangeRequest): JsonResponse
    {
        $updated = $this->shipmentChangeService->update($shipmentChangeRequest, $request->validated(), $request->user()?->id);

        return response()->json(
            (new ShipmentChangeRequestResource($updated))->resolve()
        );
    }

    public function updateStatus(UpdateShipmentChangeStatusRequest $request, ShipmentChangeRequest $shipmentChangeRequest): JsonResponse
    {
        $updated = $this->shipmentChangeService->updateStatus($shipmentChangeRequest, $request->validated(), $request->user()?->id);

        return response()->json(
            (new ShipmentChangeRequestResource($updated))->resolve()
        );
    }

    public function destroy(Request $request, ShipmentChangeRequest $shipmentChangeRequest): Response
    {
        $this->shipmentChangeService->delete($shipmentChangeRequest, $request->user()?->id);

        return response()->noContent();
    }
}
