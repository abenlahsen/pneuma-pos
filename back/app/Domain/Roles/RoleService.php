<?php

namespace App\Domain\Roles;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class RoleService
{
    /**
     * @param  Request  $request
     * @return Role
     */
    public function create($request)
    {
        $role = Role::create([
            'name' => $request->name,
            'guard_name' => 'web',
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        return $role->load('permissions');
    }

    /**
     * @param  Request  $request
     * @param  Role  $role
     * @return Role|JsonResponse
     */
    public function update($request, $role)
    {
        if ($role->name === 'Administrator' && $request->name !== 'Administrator') {
            return response()->json([
                'message' => 'Le rôle Administrator ne peut pas être renommé.',
            ], 422);
        }

        $role->update([
            'name' => $request->name,
        ]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        return $role->load('permissions');
    }

    /**
     * @param  Role  $role
     * @return JsonResponse|null
     */
    public function delete($role)
    {
        if ($role->name === 'Administrator') {
            return response()->json([
                'message' => 'Le rôle Administrator ne peut pas être supprimé.',
            ], 422);
        }

        if ($role->users()->exists()) {
            return response()->json([
                'message' => 'Ce rôle est attribué à un ou plusieurs utilisateurs.',
            ], 422);
        }

        $role->delete();

        return null;
    }

    /**
     * @param  Request  $request
     * @param  Role  $role
     * @return Role
     */
    public function assignPermissions($request, $role)
    {
        $role->syncPermissions($request->permissions);

        return $role->load('permissions');
    }
}