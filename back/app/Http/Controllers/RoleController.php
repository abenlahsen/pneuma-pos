<?php

namespace App\Http\Controllers;

use App\Domain\Roles\RoleService;
use App\Http\Resources\Users\RoleResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    private RoleService $roleService;

    public function __construct(RoleService $roleService)
    {
        $this->roleService = $roleService;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Role::with('permissions');

        if ($request->boolean('all')) {
            return response()->json(RoleResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => RoleResource::collection($paginated->items())->resolve($request),
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
            'name' => 'required|string|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        $role = $this->roleService->create($request);

        return response()->json((new RoleResource($role))->resolve($request), 201);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json((new RoleResource($role->load('permissions')))->resolve(request()));
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|unique:roles,name,' . $role->id,
            'permissions' => 'array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        $updatedRole = $this->roleService->update($request, $role);

        if ($updatedRole instanceof JsonResponse) {
            return $updatedRole;
        }

        return response()->json((new RoleResource($updatedRole))->resolve($request));
    }

    public function destroy(Role $role): JsonResponse
    {
        $response = $this->roleService->delete($role);

        if ($response instanceof JsonResponse) {
            return $response;
        }

        return response()->json(null, 204);
    }

    public function assignPermissions(Request $request, Role $role): JsonResponse
    {
        $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        $updatedRole = $this->roleService->assignPermissions($request, $role);

        return response()->json((new RoleResource($updatedRole))->resolve($request));
    }
}