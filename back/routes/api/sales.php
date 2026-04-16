<?php

use Illuminate\Support\Facades\Route;

// Sales
Route::middleware('permission:view sales')->group(function () {
    Route::get('/sales-summary', [\App\Http\Controllers\SaleController::class, 'summary']);
    Route::get('/sales-filters', [\App\Http\Controllers\SaleController::class, 'filters']);
    Route::get('sales', [\App\Http\Controllers\SaleController::class, 'index']);
    Route::get('sales/{sale}', [\App\Http\Controllers\SaleController::class, 'show']);
});
Route::post('sales', [\App\Http\Controllers\SaleController::class, 'store'])->middleware('permission:create sales');
Route::put('sales/{sale}', [\App\Http\Controllers\SaleController::class, 'update'])->middleware('permission:edit sales');
Route::delete('sales/{sale}', [\App\Http\Controllers\SaleController::class, 'destroy'])->middleware('permission:delete sales');

// Sale Payments
Route::get('sales/{sale}/payments', [\App\Http\Controllers\PaymentController::class, 'index'])->middleware('permission:view sales');
Route::post('sales/{sale}/payments', [\App\Http\Controllers\PaymentController::class, 'store'])->middleware('permission:manage sale-payments');
Route::delete('sales/{sale}/payments/{payment}', [\App\Http\Controllers\PaymentController::class, 'destroy'])->middleware('permission:manage sale-payments');
