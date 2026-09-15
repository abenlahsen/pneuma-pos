<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tant que `must_change_password` est leve, le jeton n'ouvre que les routes
 * de session (`/api/user`, `/api/logout`, `/api/change-password`), qui sont
 * enregistrees hors du groupe portant ce middleware. Tout le reste repond
 * 403 avec le code `PASSWORD_CHANGE_REQUIRED`, que l'intercepteur Angular
 * traduit en redirection vers /change-password.
 */
class EnsurePasswordChanged
{
    public const CODE = 'PASSWORD_CHANGE_REQUIRED';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            return response()->json([
                'message' => 'Vous devez changer votre mot de passe avant de continuer.',
                'code' => self::CODE,
            ], 403);
        }

        return $next($request);
    }
}
