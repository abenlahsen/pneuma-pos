<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
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
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'role' => 'nullable|string|exists:roles,name',
        ]);

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

        return response()->json($user->load('roles'), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->load('roles'));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        $actor = $request->user();

        // H1: Only an Administrator can change a user's role. Prevent privilege
        // escalation and last-admin lockout when demoting an administrator.
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

        return response()->json($user->load('roles'));
    }

    public function destroy(Request $request, User $user): JsonResponse
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
        return response()->json(null, 204);
    }
}
