<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Protected auth routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    // Meme limiteur que /login : cette route est un oracle sur le mot de passe courant.
    Route::post('/change-password', [AuthController::class, 'changePassword'])->middleware('throttle:login');
});
