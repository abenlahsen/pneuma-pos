<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\VehicleController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('clients')->group(function () {
    Route::get('/', [ClientController::class, 'index'])->middleware('permission:view clients');
    Route::post('/', [ClientController::class, 'store'])->middleware('permission:create clients');
    Route::get('/duplicates/check', [ClientController::class, 'duplicates'])->middleware('permission:view clients');

    // Opérations sur un véhicule individuel (avant /{client} pour éviter tout conflit)
    Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->middleware('permission:view clients');
    Route::match(['put', 'patch'], '/vehicles/{vehicle}', [VehicleController::class, 'update'])->middleware('permission:edit clients');
    Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy'])->middleware('permission:edit clients');

    Route::get('/{client}', [ClientController::class, 'show'])->middleware('permission:view clients');
    Route::get('/{client}/profile', [ClientController::class, 'profile'])->middleware('permission:view clients');
    Route::get('/{client}/statement', [ClientController::class, 'statement'])->middleware('permission:view clients');
    Route::get('/{client}/vehicles', [VehicleController::class, 'index'])->middleware('permission:view clients');
    Route::post('/{client}/vehicles', [VehicleController::class, 'store'])->middleware('permission:edit clients');
    Route::match(['put', 'patch'], '/{client}', [ClientController::class, 'update'])->middleware('permission:edit clients');
    Route::delete('/{client}', [ClientController::class, 'destroy'])->middleware('permission:delete clients');
});
