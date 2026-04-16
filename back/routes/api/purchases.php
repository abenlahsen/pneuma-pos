<?php

use Illuminate\Support\Facades\Route;

// Purchases (Achats)
Route::middleware('permission:view purchases')->group(function () {
    Route::get('purchases-summary', [\App\Http\Controllers\PurchaseController::class, 'summary']);
    Route::get('purchases-filters', [\App\Http\Controllers\PurchaseController::class, 'filters']);
    Route::get('purchases', [\App\Http\Controllers\PurchaseController::class, 'index']);
    Route::get('purchases/{purchase}', [\App\Http\Controllers\PurchaseController::class, 'show']);
});
Route::post('purchases', [\App\Http\Controllers\PurchaseController::class, 'store'])->middleware('permission:create purchases');
Route::put('purchases/{purchase}', [\App\Http\Controllers\PurchaseController::class, 'update'])->middleware('permission:edit purchases');
Route::delete('purchases/{purchase}', [\App\Http\Controllers\PurchaseController::class, 'destroy'])->middleware('permission:delete purchases');

// Purchase Payments
Route::get('purchases/{purchase}/payments', [\App\Http\Controllers\PurchasePaymentController::class, 'index'])->middleware('permission:view purchases');
Route::post('purchases/{purchase}/payments', [\App\Http\Controllers\PurchasePaymentController::class, 'store'])->middleware('permission:manage purchase-payments');
Route::delete('purchases/{purchase}/payments/{payment}', [\App\Http\Controllers\PurchasePaymentController::class, 'destroy'])->middleware('permission:manage purchase-payments');