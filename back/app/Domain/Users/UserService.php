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

        // Le mot de passe saisi par l'admin est un mot de passe temporaire :
        // l'utilisateur doit le remplacer a sa premiere connexion.
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'commission_rate' => $request->commission_rate,
            'prime_per_tyre' => $request->prime_per_tyre,
            'monthly_target' => $request->monthly_target,
            'must_change_password' => true,
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

        if ($denied = $this->guardAdministratorTarget($actor, $user)) {
            return $denied;
        }

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
            'prime_per_tyre' => $request->prime_per_tyre,
            'monthly_target' => $request->monthly_target,
        ];

        $passwordResetByOther = $request->filled('password') && $actor->id !== $user->id;

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        if ($passwordResetByOther) {
            // Reinitialisation par un tiers : mot de passe temporaire, et les
            // sessions ouvertes de la cible tombent.
            $data['must_change_password'] = true;
        }

        $user->update($data);

        if ($passwordResetByOther) {
            $user->tokens()->delete();
        }

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

        if ($denied = $this->guardAdministratorTarget($actor, $user)) {
            return $denied;
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

    /**
     * Un compte Administrateur n'est modifiable (mot de passe compris) que
     * par un autre Administrateur — sinon `edit users` vaut prise de controle.
     */
    private function guardAdministratorTarget(User $actor, User $target): ?JsonResponse
    {
        if ($target->hasRole('Administrator') && ! $actor->hasRole('Administrator')) {
            return response()->json([
                'message' => 'Seul un Administrateur peut modifier un compte Administrateur.',
            ], 403);
        }

        return null;
    }
}
