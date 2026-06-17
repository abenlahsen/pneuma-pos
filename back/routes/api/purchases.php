<?php

use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PurchasePaymentController;
use Illuminate\Support\Facades\Route;

// Purchases (Achats)
Route::middleware('permission:view purchases')->group(function () {
    Route::get('purchases-summary', [PurchaseController::class, 'summary']);
    Route::get('purchases-filters', [PurchaseController::class, 'filters']);
    Route::get('purchases/export', [PurchaseController::class, 'export']);
    Route::get('purchases', [PurchaseController::class, 'index']);
    Route::get('purchases/{purchase}', [PurchaseController::class, 'show']);
});
Route::post('purchases', [PurchaseController::class, 'store'])->middleware('permission:create purchases');
Route::put('purchases/{purchase}', [PurchaseController::class, 'update'])->middleware('permission:edit purchases');
Route::patch('purchases/{purchase}/status', [PurchaseController::class, 'updateStatus'])->middleware('permission:edit purchases');
Route::delete('purchases/{purchase}', [PurchaseController::class, 'destroy'])->middleware('permission:delete purchases');

// Purchase Payments
Route::get('purchases/{purchase}/payments', [PurchasePaymentController::class, 'index'])->middleware('permission:view purchases');
Route::post('purchases/{purchase}/payments', [PurchasePaymentController::class, 'store'])->middleware('permission:manage purchase-payments');
Route::delete('purchases/{purchase}/payments/{payment}', [PurchasePaymentController::class, 'destroy'])->middleware('permission:manage purchase-payments');
