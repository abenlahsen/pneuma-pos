<?php

use App\Http\Controllers\ServiceItemController;
use App\Http\Controllers\ServiceOrderController;
use App\Http\Controllers\ServicePaymentController;
use Illuminate\Support\Facades\Route;

Route::middleware('permission:view service-orders')->group(function () {
    Route::get('/service-orders-summary', [ServiceOrderController::class, 'summary']);
    Route::get('/service-orders-filters', [ServiceOrderController::class, 'filters']);
    Route::get('/service-orders-parts-search', [ServiceOrderController::class, 'searchParts']);
    Route::get('service-orders/export', [ServiceOrderController::class, 'export']);
    Route::get('service-orders', [ServiceOrderController::class, 'index']);
    Route::get('service-orders/{serviceOrder}', [ServiceOrderController::class, 'show']);
    Route::get('service-orders/{serviceOrder}/payments', [ServicePaymentController::class, 'index']);
    Route::get('service-orders/{serviceOrder}/items', [ServiceItemController::class, 'index']);
});

Route::post('service-orders', [ServiceOrderController::class, 'store'])
    ->middleware('permission:create service-orders');

Route::put('service-orders/{serviceOrder}', [ServiceOrderController::class, 'update'])
    ->middleware('permission:edit service-orders');

Route::delete('service-orders/{serviceOrder}', [ServiceOrderController::class, 'destroy'])
    ->middleware('permission:delete service-orders');

Route::post('service-orders/{serviceOrder}/payments', [ServicePaymentController::class, 'store'])
    ->middleware('permission:manage service-payments');

Route::delete('service-orders/{serviceOrder}/payments/{servicePayment}', [ServicePaymentController::class, 'destroy'])
    ->middleware('permission:manage service-payments');

Route::middleware('permission:edit service-orders')->group(function () {
    Route::post('service-orders/{serviceOrder}/items/sync', [ServiceItemController::class, 'sync']);
    Route::delete('service-orders/{serviceOrder}/items/{serviceItem}', [ServiceItemController::class, 'destroy']);
});
