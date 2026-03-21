<?php

namespace App\Http\Controllers;

use App\Models\Carrier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CarrierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Carrier::query()->latest('created_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('all')) {
            return response()->json($query->get());
        }

        return response()->json($query->paginate($request->get('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        $carrier = Carrier::create(array_merge($validated, ['user_id' => $request->user()->id]));
        return response()->json($carrier, 201);
    }

    public function show(Carrier $carrier): JsonResponse
    {
        return response()->json($carrier);
    }

    public function update(Request $request, Carrier $carrier): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        $carrier->update($validated);
        return response()->json($carrier);
    }

    public function destroy(Carrier $carrier): JsonResponse
    {
        $carrier->delete();
        return response()->json(null, 204);
    }
}
