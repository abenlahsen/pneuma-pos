<?php

namespace App\Http\Controllers\Portal;

use App\Domain\Portal\PortalAccessService;
use App\Http\Controllers\Controller;
use App\Models\ClientPortalAccount;
use App\Support\PasswordRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * L'authentification du portail client (étape 13.1), sous /api/portal.
 *
 * Contrairement à l'équipe, une connexion ne révoque pas les autres
 * sessions : un garagiste commande depuis son téléphone à l'atelier et
 * consulte son relevé au bureau.
 */
class PortalAuthController extends Controller
{
    public function __construct(private PortalAccessService $access) {}

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $account = ClientPortalAccount::query()->where('email', Str::lower(trim($validated['email'])))->first();

        if (! $account || ! $account->password || ! Hash::check($validated['password'], $account->password)) {
            return response()->json(['message' => 'Les identifiants sont incorrects.'], 401);
        }

        if (! $account->canUsePortal()) {
            return response()->json(['message' => 'Votre accès est suspendu. Contactez votre commercial.'], 403);
        }

        $account->forceFill(['last_login_at' => now()])->save();
        $token = $account->createToken('portal')->plainTextToken;

        return response()->json(['token' => $token] + $this->session($account));
    }

    public function activate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'password' => PasswordRules::newPassword(),
        ]);

        $account = $this->access->activate($validated['token'], $validated['password']);
        $account->forceFill(['last_login_at' => now()])->save();
        $token = $account->createToken('portal')->plainTextToken;

        return response()->json(['token' => $token] + $this->session($account));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => 'required|email']);
        $this->access->requestPasswordReset($validated['email']);

        // La même réponse que l'adresse existe ou non.
        return response()->json(['message' => 'Si cette adresse a un accès, un lien de réinitialisation vient d\'être envoyé.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'password' => PasswordRules::newPassword(),
        ]);

        $this->access->resetPassword($validated['token'], $validated['password']);

        return response()->json(['message' => 'Votre mot de passe est changé. Connectez-vous.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->session($request->user('portal')));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user('portal')->currentAccessToken()?->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }

    /**
     * Ce que le portail sait de sa session : le contact et son client, rien
     * de plus (pas de commercial, pas de conditions internes).
     *
     * @return array<string, mixed>
     */
    private function session(ClientPortalAccount $account): array
    {
        return [
            'account' => ['id' => $account->id, 'name' => $account->name, 'email' => $account->email],
            'client' => ['id' => $account->client->id, 'name' => $account->client->name],
        ];
    }
}
