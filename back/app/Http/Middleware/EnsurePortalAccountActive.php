<?php

namespace App\Http\Middleware;

use App\Models\ClientPortalAccount;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Derrière `auth:portal` : l'utilisateur doit être un compte portail, actif,
 * d'un client actif. La garde filtre déjà le type de jeton ; ce contrôle
 * couvre aussi un compte suspendu entre deux requêtes, ou dont le client
 * vient d'être archivé.
 */
class EnsurePortalAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $account = $request->user('portal');

        if (! $account instanceof ClientPortalAccount) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $account->canUsePortal()) {
            $account->currentAccessToken()?->delete();

            return response()->json(['message' => 'Votre accès est suspendu. Contactez votre commercial.'], 403);
        }

        return $next($request);
    }
}
