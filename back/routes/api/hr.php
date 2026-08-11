<?php

use App\Http\Controllers\HrChargeController;
use Illuminate\Support\Facades\Route;

// Charges RH — restricted to the `hr-charges` permission family
// (Administrator by default, delegable via Rôles). Confidential
// transactions are also excluded from the regular Cash Flow reads for
// anyone lacking `view hr-charges` — see TransactionService::buildFilteredQuery().
Route::middleware('permission:view hr-charges')->group(function () {
    Route::get('/hr-charges', [HrChargeController::class, 'index']);
    Route::get('/hr-charges-summary', [HrChargeController::class, 'summary']);
    Route::get('/hr-charges-filters', [HrChargeController::class, 'filters']);
});
Route::post('/hr-charges', [HrChargeController::class, 'store'])->middleware('permission:create hr-charges');
Route::put('/hr-charges/{transaction}', [HrChargeController::class, 'update'])->middleware('permission:edit hr-charges');
Route::delete('/hr-charges/{transaction}', [HrChargeController::class, 'destroy'])->middleware('permission:delete hr-charges');
Route::put('/hr-employees/{user}', [HrChargeController::class, 'updateEmployee'])->middleware('permission:edit hr-charges');
