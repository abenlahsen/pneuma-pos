<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\AccountController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Admin dashboard KPI snapshot
    Route::get('/dashboard-kpi', [\App\Http\Controllers\DashboardController::class, 'kpi'])
        ->middleware('role:Administrator');

    // Accounts
    Route::middleware('permission:view accounts')->group(function () {
        Route::get('accounts', [AccountController::class, 'index']);
        Route::get('accounts/{account}', [AccountController::class, 'show']);
    });
    Route::post('accounts', [AccountController::class, 'store'])->middleware('permission:create accounts');
    Route::put('accounts/{account}', [AccountController::class, 'update'])->middleware('permission:edit accounts');
    Route::delete('accounts/{account}', [AccountController::class, 'destroy'])->middleware('permission:delete accounts');
    Route::post('accounts/transfer', [AccountController::class, 'transfer'])->middleware('permission:transfer accounts');

    // Cash Flow / Transactions
    Route::middleware('permission:view cash-flow')->group(function () {
        Route::get('/transactions-summary', [TransactionController::class, 'summary']);
        Route::get('/transactions-filters', [TransactionController::class, 'filters']);
        Route::get('transactions', [TransactionController::class, 'index']);
        Route::get('transactions/{transaction}', [TransactionController::class, 'show']);
    });
    Route::post('transactions', [TransactionController::class, 'store'])->middleware('permission:create cash-flow');
    Route::put('transactions/{transaction}', [TransactionController::class, 'update'])->middleware('permission:edit cash-flow');
    Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy'])->middleware('permission:delete cash-flow');

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

    // Suppliers
    Route::get('suppliers', [\App\Http\Controllers\SupplierController::class, 'index'])->middleware('permission:view suppliers');
    Route::get('suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'show'])->middleware('permission:view suppliers');
    Route::post('suppliers', [\App\Http\Controllers\SupplierController::class, 'store'])->middleware('permission:create suppliers');
    Route::put('suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'update'])->middleware('permission:edit suppliers');
    Route::delete('suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'destroy'])->middleware('permission:delete suppliers');

    // Carriers (Transporteurs)
    Route::get('carriers', [\App\Http\Controllers\CarrierController::class, 'index'])->middleware('permission:view carriers');
    Route::get('carriers/{carrier}', [\App\Http\Controllers\CarrierController::class, 'show'])->middleware('permission:view carriers');
    Route::post('carriers', [\App\Http\Controllers\CarrierController::class, 'store'])->middleware('permission:create carriers');
    Route::put('carriers/{carrier}', [\App\Http\Controllers\CarrierController::class, 'update'])->middleware('permission:edit carriers');
    Route::delete('carriers/{carrier}', [\App\Http\Controllers\CarrierController::class, 'destroy'])->middleware('permission:delete carriers');

    // Partners (Partenaires)
    Route::get('partners', [\App\Http\Controllers\PartnerController::class, 'index'])->middleware('permission:view partners');
    Route::get('partners/{partner}', [\App\Http\Controllers\PartnerController::class, 'show'])->middleware('permission:view partners');
    Route::post('partners', [\App\Http\Controllers\PartnerController::class, 'store'])->middleware('permission:create partners');
    Route::put('partners/{partner}', [\App\Http\Controllers\PartnerController::class, 'update'])->middleware('permission:edit partners');
    Route::delete('partners/{partner}', [\App\Http\Controllers\PartnerController::class, 'destroy'])->middleware('permission:delete partners');

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

    // ACL: Roles & Permissions
    Route::middleware('permission:view roles')->group(function () {
        Route::get('roles', [RoleController::class, 'index']);
        Route::get('roles/{role}', [RoleController::class, 'show']);
        Route::get('permissions', [PermissionController::class, 'index']);
    });
    Route::post('roles', [RoleController::class, 'store'])->middleware('permission:create roles');
    Route::put('roles/{role}', [RoleController::class, 'update'])->middleware('permission:edit roles');
    Route::put('roles/{role}/permissions', [RoleController::class, 'assignPermissions'])->middleware('permission:edit roles');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:delete roles');
    Route::post('permissions', [PermissionController::class, 'store'])->middleware('permission:create roles');
    Route::delete('permissions/{permission}', [PermissionController::class, 'destroy'])->middleware('permission:delete roles');

    // Stock
    Route::middleware('permission:view stock')->group(function () {
        Route::get('stocks-summary', [StockController::class, 'summary']);
        Route::get('stocks-filters', [StockController::class, 'filters']);
        Route::get('stocks', [StockController::class, 'index']);
        Route::get('stocks/{stock}', [StockController::class, 'show']);
    });
    Route::post('stocks', [StockController::class, 'store'])->middleware('permission:create stock');
    Route::put('stocks/{stock}', [StockController::class, 'update'])->middleware('permission:edit stock');
    Route::delete('stocks/{stock}', [StockController::class, 'destroy'])->middleware('permission:delete stock');
    Route::post('stocks/import', [StockController::class, 'import'])->middleware('permission:import stock');

    // Stock Movements (audit trail)
    Route::get('stock-movements', [StockMovementController::class, 'index'])->middleware('permission:view stock-movements');

    // Brands
    Route::middleware('permission:view brands')->group(function () {
        Route::get('brands', [BrandController::class, 'index']);
        Route::get('brands/{brand}', [BrandController::class, 'show']);
    });
    Route::post('brands', [BrandController::class, 'store'])->middleware('permission:create brands');
    Route::put('brands/{brand}', [BrandController::class, 'update'])->middleware('permission:edit brands');
    Route::patch('brands/{brand}/toggle-active', [BrandController::class, 'toggleActive'])->middleware('permission:edit brands');
    Route::delete('brands/{brand}', [BrandController::class, 'destroy'])->middleware('permission:delete brands');

    // Products
    Route::middleware('permission:view products')->group(function () {
        Route::get('products', [ProductController::class, 'index']);
        Route::get('products-filters', [ProductController::class, 'filters']);
        Route::get('products/{product}', [ProductController::class, 'show']);
    });
    Route::post('products', [ProductController::class, 'store'])->middleware('permission:create products');
    Route::put('products/{product}', [ProductController::class, 'update'])->middleware('permission:edit products');
    Route::patch('products/{product}/toggle-active', [ProductController::class, 'toggleActive'])->middleware('permission:edit products');
    Route::delete('products/{product}', [ProductController::class, 'destroy'])->middleware('permission:delete products');

    // Users management
    Route::get('users', [UserController::class, 'index'])->middleware('permission:view users');
    Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:view users');
    Route::post('users', [UserController::class, 'store'])->middleware('permission:create users');
    Route::put('users/{user}', [UserController::class, 'update'])->middleware('permission:edit users');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:delete users');
});
