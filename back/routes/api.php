<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Cash Flow / Transactions
    Route::get('/transactions-summary', [TransactionController::class, 'summary']);
    Route::get('/transactions-filters', [TransactionController::class, 'filters']);
    Route::apiResource('transactions', TransactionController::class);

    // Sales
    Route::get('/sales-summary', [\App\Http\Controllers\SaleController::class, 'summary']);
    Route::get('/sales-filters', [\App\Http\Controllers\SaleController::class, 'filters']);
    Route::apiResource('sales', \App\Http\Controllers\SaleController::class);

    // Suppliers
    Route::apiResource('suppliers', \App\Http\Controllers\SupplierController::class);

    // Sales Reps (Commerciaux)
    Route::apiResource('sales-reps', \App\Http\Controllers\SalesRepController::class);

    // Carriers (Transporteurs)
    Route::apiResource('carriers', \App\Http\Controllers\CarrierController::class);

    // Partners (Partenaires)
    Route::apiResource('partners', \App\Http\Controllers\PartnerController::class);
});

