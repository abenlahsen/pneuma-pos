<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Permission::query();

        if ($request->boolean('all')) {
            return response()->json($query->get());
        }

        return response()->json($query->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|unique:permissions,name',
        ]);

        $permission = Permission::create(['name' => $request->name, 'guard_name' => 'web']);

        return response()->json($permission, 201);
    }

    public function show(Permission $permission): JsonResponse
    {
        return response()->json($permission);
    }

    public function update(Request $request, Permission $permission): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|unique:permissions,name,' . $permission->id,
        ]);

        $permission->update(['name' => $request->name]);

        return response()->json($permission);
    }

    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();
        return response()->json(null, 204);
    }
}
