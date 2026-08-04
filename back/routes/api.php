<?php

use Illuminate\Support\Facades\Route;

require __DIR__.'/api/auth.php';

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    require __DIR__.'/api/accounts.php';
    require __DIR__.'/api/transaction_categories.php';
    require __DIR__.'/api/catalog.php';
    require __DIR__.'/api/clients.php';
    require __DIR__.'/api/sales.php';
    require __DIR__.'/api/purchases.php';
    require __DIR__.'/api/stock.php';
    require __DIR__.'/api/service_orders.php';
    require __DIR__.'/api/shipments.php';
    require __DIR__.'/api/admin.php';
    require __DIR__.'/api/activity_logs.php';
});
