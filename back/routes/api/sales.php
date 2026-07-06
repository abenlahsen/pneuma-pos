<?php

use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SaleController;
use Illuminate\Support\Facades\Route;

// Sales
Route::middleware('permission:view sales')->group(function () {
    Route::get('/sales-summary', [SaleController::class, 'summary']);
    Route::get('/sales-filters', [SaleController::class, 'filters']);
    Route::get('sales/export', [SaleController::class, 'export']);
    Route::get('sales', [SaleController::class, 'index']);
    Route::get('sales/{sale}', [SaleController::class, 'show']);
});
Route::post('sales', [SaleController::class, 'store'])->middleware('permission:create sales');
Route::put('sales/{sale}', [SaleController::class, 'update'])->middleware('permission:edit sales');
Route::delete('sales/{sale}', [SaleController::class, 'destroy'])->middleware('permission:delete sales');

// Sale Payments
Route::get('sales/{sale}/payments', [PaymentController::class, 'index'])->middleware('permission:view sales');
Route::post('sales/{sale}/payments', [PaymentController::class, 'store'])->middleware('permission:manage sale-payments');
Route::delete('sales/{sale}/payments/{payment}', [PaymentController::class, 'destroy'])->middleware('permission:manage sale-payments');

// Sale payment detail (unscoped — shows every sale a payment covers, single or multi)
Route::get('sale-payments/{payment}', [PaymentController::class, 'show'])->middleware('permission:view sales');
