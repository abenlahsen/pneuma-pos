<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\Auth\AuthSessionResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Login an existing user.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Les identifiants sont incorrects.',
            ], 401);
        }

        // Revoke all previous tokens
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json((new AuthSessionResource([
            'user' => $user->load('roles:id,name'),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'token' => $token,
            'must_change_password' => (bool) $user->must_change_password,
        ]))->resolve($request));
    }

    /**
     * Get the authenticated user.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Non authentifié.',
            ], 401);
        }

        return response()->json((new AuthSessionResource([
            'user' => $user->load('roles:id,name'),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'must_change_password' => (bool) $user->must_change_password,
        ]))->resolve($request));
    }

    /**
     * Change password (used for forced password change on first login).
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe actuel est incorrect.',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'must_change_password' => false,
        ]);

        return response()->json([
            'message' => 'Mot de passe modifié avec succès.',
        ]);
    }

    /**
     * Logout the authenticated user.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'message' => 'Déconnexion réussie.',
        ]);
    }
}
