<?php

namespace App\Domain\Users;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserService
{
    /**
     * @param  Request  $request
     * @return User|JsonResponse
     */
    public function create($request)
    {
        $actor = $request->user();

        if ($request->filled('role') && $request->role === 'Administrator' && ! $actor->hasRole('Administrator')) {
            return response()->json([
                'message' => 'Seul un Administrateur peut attribuer le rôle Administrator.',
            ], 403);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'commission_rate' => $request->commission_rate,
        ]);

        if ($request->filled('role')) {
            $user->assignRole($request->role);
        }

        return $user->load('roles');
    }

    /**
     * @param  Request  $request
     * @param  User  $user
     * @return User|JsonResponse
     */
    public function update($request, $user)
    {
        $actor = $request->user();

        if ($request->has('role')) {
            if (! $actor->hasRole('Administrator')) {
                return response()->json([
                    'message' => 'Seul un Administrateur peut modifier les rôles.',
                ], 403);
            }

            $newRole = $request->filled('role') ? $request->role : null;
            $wasAdmin = $user->hasRole('Administrator');
            $willBeAdmin = $newRole === 'Administrator';

            if ($wasAdmin && ! $willBeAdmin) {
                $otherAdmins = User::role('Administrator')->where('id', '!=', $user->id)->count();

                if ($otherAdmins === 0) {
                    return response()->json([
                        'message' => 'Impossible de retirer le dernier Administrateur.',
                    ], 422);
                }
            }
        }

        $data = [
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'commission_rate' => $request->commission_rate,
        ];

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        if ($request->has('role')) {
            $user->syncRoles($request->filled('role') ? [$request->role] : []);
        }

        return $user->load('roles');
    }

    /**
     * @param  Request  $request
     * @param  User  $user
     * @return JsonResponse|null
     */
    public function delete($request, $user)
    {
        $actor = $request->user();

        if ($actor->id === $user->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ], 422);
        }

        if ($user->hasRole('Administrator')) {
            $otherAdmins = User::role('Administrator')->where('id', '!=', $user->id)->count();

            if ($otherAdmins === 0) {
                return response()->json([
                    'message' => 'Impossible de supprimer le dernier Administrateur.',
                ], 422);
            }
        }

        $user->delete();

        return null;
    }
}