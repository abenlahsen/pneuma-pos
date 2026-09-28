<?php

use App\Http\Controllers\Portal\PortalAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Portail client — /api/portal/* (étape 13)
|--------------------------------------------------------------------------
|
| Un second public : garde `portal`, jetons à part, aucune route de
| l'agence. Toute donnée se résout depuis le compte du jeton, jamais depuis
| un paramètre : aucune route n'accepte de client_id.
|
*/

Route::prefix('portal')->group(function () {
    // Public : connexion, activation, mot de passe oublié.
    Route::post('login', [PortalAuthController::class, 'login'])->middleware('throttle:portal-login');
    Route::post('activate', [PortalAuthController::class, 'activate'])->middleware('throttle:portal-public');
    Route::post('password/forgot', [PortalAuthController::class, 'forgotPassword'])->middleware('throttle:portal-public');
    Route::post('password/reset', [PortalAuthController::class, 'resetPassword'])->middleware('throttle:portal-public');

    Route::middleware(['auth:portal', 'portal.active', 'throttle:portal'])->group(function () {
        Route::get('me', [PortalAuthController::class, 'me']);
        Route::post('logout', [PortalAuthController::class, 'logout']);
    });
});
