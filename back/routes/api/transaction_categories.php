<?php

use App\Http\Controllers\TransactionCategoryController;
use Illuminate\Support\Facades\Route;

// Transaction categories (Cash Flow — catégories & sous-catégories paramétrables)
Route::get('transaction-categories', [TransactionCategoryController::class, 'index'])
    ->middleware('permission:view transaction-categories');

Route::post('transaction-categories', [TransactionCategoryController::class, 'store'])
    ->middleware('permission:create transaction-categories');

Route::put('transaction-categories/{transactionCategory}', [TransactionCategoryController::class, 'update'])
    ->middleware('permission:edit transaction-categories');

Route::delete('transaction-categories/{transactionCategory}', [TransactionCategoryController::class, 'destroy'])
    ->middleware('permission:delete transaction-categories');
