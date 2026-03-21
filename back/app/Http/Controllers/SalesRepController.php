<?php

namespace App\Http\Controllers;

use App\Models\SalesRep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesRepController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SalesRep::query()->latest('created_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
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
            'commission_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $rep = SalesRep::create(array_merge($validated, ['user_id' => $request->user()->id]));
        return response()->json($rep, 201);
    }

    public function show(SalesRep $salesRep): JsonResponse
    {
        return response()->json($salesRep);
    }

    public function update(Request $request, SalesRep $salesRep): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $salesRep->update($validated);
        return response()->json($salesRep);
    }

    public function destroy(SalesRep $salesRep): JsonResponse
    {
        $salesRep->delete();
        return response()->json(null, 204);
    }
}
