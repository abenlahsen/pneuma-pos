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
            'password' => 'required|string|min:6|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'role' => 'nullable|string|exists:roles,name',
        ]);

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
            'password' => 'nullable|string|min:6|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'role' => 'nullable|string|exists:roles,name',
        ]);

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

    public function destroy(User $user): JsonResponse
    {
        $user->delete();
        return response()->json(null, 204);
    }
}
