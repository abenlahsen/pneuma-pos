<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class VehicleController extends Controller
{
    public function index(Request $request, Client $client): JsonResponse
    {
        $vehicles = $client->vehicles()
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->orderBy('brand')
            ->orderBy('model_name')
            ->get();

        return response()->json($vehicles);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $validated = $request->validate([
            'plate'             => ['required', 'string', 'max:20', 'regex:/^\d{1,5}-[A-Za-z]{1,3}-\d{2,4}$/'],
            'brand'             => ['required', 'string', 'max:100'],
            'model_name'        => ['required', 'string', 'max:100'],
            'circulation_month' => ['required', 'integer', 'min:1', 'max:12'],
            'circulation_year'  => ['required', 'integer', 'min:1900', 'max:'.date('Y')],
            'vin'               => ['nullable', 'string', 'size:17', 'unique:vehicles,vin'],
            'notes'             => ['nullable', 'string', 'max:1000'],
            'is_active'         => ['boolean'],
        ]);

        $vehicle = $client->vehicles()->create(array_merge($validated, [
            'created_by' => $request->user()?->id,
        ]));

        return response()->json($vehicle, 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return response()->json($vehicle->load('client'));
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        $validated = $request->validate([
            'plate'             => ['sometimes', 'required', 'string', 'max:20', 'regex:/^\d{1,5}-[A-Za-z]{1,3}-\d{2,4}$/'],
            'brand'             => ['sometimes', 'required', 'string', 'max:100'],
            'model_name'        => ['sometimes', 'required', 'string', 'max:100'],
            'circulation_month' => ['sometimes', 'required', 'integer', 'min:1', 'max:12'],
            'circulation_year'  => ['sometimes', 'required', 'integer', 'min:1900', 'max:'.date('Y')],
            'vin'               => ['nullable', 'string', 'size:17', Rule::unique('vehicles', 'vin')->ignore($vehicle->id)],
            'notes'             => ['nullable', 'string', 'max:1000'],
            'is_active'         => ['boolean'],
        ]);

        $vehicle->update(array_merge($validated, [
            'updated_by' => $request->user()?->id,
        ]));

        return response()->json($vehicle->fresh());
    }

    public function destroy(Vehicle $vehicle): JsonResponse|Response
    {
        $usageCount = $vehicle->serviceOrders()->count() + $vehicle->sales()->count();

        if ($usageCount > 0) {
            $vehicle->update(['is_active' => false]);

            return response()->json([
                'message'     => "Le véhicule a été désactivé car il est lié à {$usageCount} document(s).",
                'deactivated' => true,
            ]);
        }

        $vehicle->delete();

        return response()->noContent();
    }
}
