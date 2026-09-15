<?php

namespace App\Domain\Roles;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleService
{
    /**
     * @param  Request  $request
     * @return Role|JsonResponse
     */
    public function create($request)
    {
        if ($request->has('permissions')) {
            $denied = $this->guardPermissionGrant($request->user(), null, (array) $request->permissions);
            if ($denied) {
                return $denied;
            }
        }

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

        if ($request->has('permissions')) {
            $denied = $this->guardPermissionGrant($request->user(), $role, (array) $request->permissions);
            if ($denied) {
                return $denied;
            }
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
     * @return Role|JsonResponse
     */
    public function assignPermissions($request, $role)
    {
        $denied = $this->guardPermissionGrant($request->user(), $role, (array) $request->permissions);
        if ($denied) {
            return $denied;
        }

        $role->syncPermissions($request->permissions);

        return $role->load('permissions');
    }

    /**
     * Trois regles, dans l'ordre :
     *  1. le jeu de permissions du role Administrator est fige (il porte tout,
     *     par le seeder) — personne ne le modifie par l'API ;
     *  2. un non-Administrateur ne touche pas aux permissions d'un role qu'il
     *     detient lui-meme (sinon `edit roles` vaut auto-promotion) ;
     *  3. un non-Administrateur n'accorde que des permissions qu'il possede.
     *
     * @param  array<int, int|string>  $permissionIds
     */
    private function guardPermissionGrant(User $actor, ?Role $role, array $permissionIds): ?JsonResponse
    {
        if ($role && $role->name === 'Administrator') {
            return response()->json([
                'message' => 'Les permissions du rôle Administrator ne peuvent pas être modifiées.',
            ], 422);
        }

        if ($actor->hasRole('Administrator')) {
            return null;
        }

        if ($role && $actor->hasRole($role->name)) {
            return response()->json([
                'message' => 'Vous ne pouvez pas modifier les permissions d’un rôle qui vous est attribué.',
            ], 403);
        }

        $requested = Permission::query()->whereIn('id', $permissionIds)->pluck('name');
        $held = $actor->getAllPermissions()->pluck('name');
        $missing = $requested->diff($held)->values();

        if ($missing->isNotEmpty()) {
            return response()->json([
                'message' => 'Vous ne pouvez pas accorder des permissions que vous ne détenez pas : '.$missing->implode(', ').'.',
            ], 403);
        }

        return null;
    }
}
