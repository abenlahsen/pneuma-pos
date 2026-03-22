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

    // Personnels (Commerciaux, Chauffeurs, Techniciens)
    Route::apiResource('personnels', \App\Http\Controllers\PersonnelController::class);

    // Carriers (Transporteurs)
    Route::apiResource('carriers', \App\Http\Controllers\CarrierController::class);

    // Partners (Partenaires)
    Route::apiResource('partners', \App\Http\Controllers\PartnerController::class);

    // Purchases (Achats)
    Route::get('purchases-summary', [\App\Http\Controllers\PurchaseController::class, 'summary']);
    Route::apiResource('purchases', \App\Http\Controllers\PurchaseController::class);
    
    // Purchase Payments (nested under purchases)
    Route::get('purchases/{purchase}/payments', [\App\Http\Controllers\PurchasePaymentController::class, 'index']);
    Route::post('purchases/{purchase}/payments', [\App\Http\Controllers\PurchasePaymentController::class, 'store']);
    Route::delete('purchases/{purchase}/payments/{payment}', [\App\Http\Controllers\PurchasePaymentController::class, 'destroy']);

    // Payments (nested under sales)
    Route::get('sales/{sale}/payments', [\App\Http\Controllers\PaymentController::class, 'index']);
    Route::post('sales/{sale}/payments', [\App\Http\Controllers\PaymentController::class, 'store']);
    Route::delete('sales/{sale}/payments/{payment}', [\App\Http\Controllers\PaymentController::class, 'destroy']);
});

