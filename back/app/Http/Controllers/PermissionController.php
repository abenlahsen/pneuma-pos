<?php

namespace App\Http\Controllers;

use App\Http\Resources\Users\PermissionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Permission::query();

        if ($request->boolean('all')) {
            return response()->json(PermissionResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 50));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => PermissionResource::collection($paginated->items())->resolve($request),
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

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|unique:permissions,name',
        ]);

        $permission = Permission::create(['name' => $request->name, 'guard_name' => 'web']);

        return response()->json((new PermissionResource($permission))->resolve($request), 201);
    }

    public function show(Permission $permission): JsonResponse
    {
        return response()->json((new PermissionResource($permission))->resolve(request()));
    }

    public function update(Request $request, Permission $permission): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|unique:permissions,name,' . $permission->id,
        ]);

        $permission->update(['name' => $request->name]);

        return response()->json((new PermissionResource($permission))->resolve($request));
    }

    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();

        return response()->json(null, 204);
    }
}