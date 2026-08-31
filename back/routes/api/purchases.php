<?php

use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PurchasePaymentController;
use App\Http\Controllers\PurchaseReturnController;
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

// Purchase payment detail (unscoped — shows every purchase a payment covers, single or multi)
Route::get('purchase-payments/{payment}', [PurchasePaymentController::class, 'show'])->middleware('permission:view purchases');

// Purchase Returns (retours fournisseur)
Route::get('purchases/{purchase}/returns', [PurchaseReturnController::class, 'index'])->middleware('permission:view purchases');
Route::post('purchases/{purchase}/returns', [PurchaseReturnController::class, 'store'])->middleware('permission:cancel purchases');
Route::delete('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'destroy'])->middleware('permission:cancel purchases');
