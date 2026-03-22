<?php

namespace App\Http\Controllers;

use App\Models\Personnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PersonnelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Personnel::query()->latest('created_at');

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
            'role' => 'required|in:Commercial,Chauffeur,Technicien',
            'phone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $rep = Personnel::create(array_merge($validated, ['user_id' => $request->user()->id]));
        return response()->json($rep, 201);
    }

    public function show(Personnel $personnel): JsonResponse
    {
        return response()->json($personnel);
    }

    public function update(Request $request, Personnel $personnel): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'role' => 'sometimes|required|in:Commercial,Chauffeur,Technicien',
            'phone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        $personnel->update($validated);
        return response()->json($personnel);
    }

    public function destroy(Personnel $personnel): JsonResponse
    {
        $personnel->delete();
        return response()->json(null, 204);
    }
}
