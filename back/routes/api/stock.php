<?php

use App\Http\Controllers\StockController;
use App\Http\Controllers\StockMovementController;
use Illuminate\Support\Facades\Route;

// Stock
Route::middleware('permission:view stock')->group(function () {
    Route::get('stocks-summary', [StockController::class, 'summary']);
    Route::get('stocks-filters', [StockController::class, 'filters']);
    Route::get('stocks', [StockController::class, 'index']);
    Route::get('stocks/export', [StockController::class, 'export']);
    Route::get('stocks/{stock}', [StockController::class, 'show']);
});
Route::post('stocks', [StockController::class, 'store'])->middleware('permission:create stock');
Route::put('stocks/{stock}', [StockController::class, 'update'])->middleware('permission:edit stock');
Route::delete('stocks/{stock}', [StockController::class, 'destroy'])->middleware('permission:delete stock');
Route::post('stocks/import', [StockController::class, 'import'])->middleware('permission:import stock');

// Stock Movements (audit trail)
Route::get('stock-movements', [StockMovementController::class, 'index'])->middleware('permission:view stock-movements');
