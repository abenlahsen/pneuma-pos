<?php

use App\Http\Controllers\Portal\PortalAuthController;
use App\Http\Controllers\Portal\PortalCatalogController;
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

        // 13.2 : catalogue, compte, relevé, documents — du client du jeton.
        Route::get('catalog', [PortalCatalogController::class, 'catalog']);
        Route::get('catalog/filters', [PortalCatalogController::class, 'filters']);
        Route::get('account', [PortalCatalogController::class, 'account']);
        Route::get('statement', [PortalCatalogController::class, 'statement']);
        Route::get('documents', [PortalCatalogController::class, 'documents']);
        Route::get('documents/{document}', [PortalCatalogController::class, 'document']);
    });
});
