<?php

use App\Http\Controllers\ClientController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('clients')->group(function () {
    Route::get('/', [ClientController::class, 'index'])->middleware('permission:view clients');
    Route::post('/', [ClientController::class, 'store'])->middleware('permission:create clients');
    Route::get('/duplicates/check', [ClientController::class, 'duplicates'])->middleware('permission:view clients');
    Route::get('/{client}', [ClientController::class, 'show'])->middleware('permission:view clients');
    Route::get('/{client}/profile', [ClientController::class, 'profile'])->middleware('permission:view clients');
    Route::get('/{client}/statement', [ClientController::class, 'statement'])->middleware('permission:view clients');
    Route::match(['put', 'patch'], '/{client}', [ClientController::class, 'update'])->middleware('permission:edit clients');
    Route::delete('/{client}', [ClientController::class, 'destroy'])->middleware('permission:delete clients');
});