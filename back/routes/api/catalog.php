<?php

use App\Http\Controllers\BrandController;
use App\Http\Controllers\CarrierController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\PartnerController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SupplierController;
use Illuminate\Support\Facades\Route;

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

// Suppliers
Route::get('suppliers', [SupplierController::class, 'index'])->middleware('permission:view suppliers');
Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->middleware('permission:view suppliers');
Route::post('suppliers', [SupplierController::class, 'store'])->middleware('permission:create suppliers');
Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:edit suppliers');
Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:delete suppliers');

// Carriers (Transporteurs)
Route::get('carriers', [CarrierController::class, 'index'])->middleware('permission:view carriers');
Route::get('carriers/{carrier}', [CarrierController::class, 'show'])->middleware('permission:view carriers');
Route::post('carriers', [CarrierController::class, 'store'])->middleware('permission:create carriers');
Route::put('carriers/{carrier}', [CarrierController::class, 'update'])->middleware('permission:edit carriers');
Route::delete('carriers/{carrier}', [CarrierController::class, 'destroy'])->middleware('permission:delete carriers');

// Partners (Partenaires)
Route::get('partners', [PartnerController::class, 'index'])->middleware('permission:view partners');
Route::get('partners/{partner}', [PartnerController::class, 'show'])->middleware('permission:view partners');
Route::post('partners', [PartnerController::class, 'store'])->middleware('permission:create partners');
Route::put('partners/{partner}', [PartnerController::class, 'update'])->middleware('permission:edit partners');
Route::delete('partners/{partner}', [PartnerController::class, 'destroy'])->middleware('permission:delete partners');

// Clients
Route::get('clients', [ClientController::class, 'index'])->middleware('permission:view clients');
Route::get('clients/{client}', [ClientController::class, 'show'])->middleware('permission:view clients');
Route::post('clients', [ClientController::class, 'store'])->middleware('permission:create clients');
Route::put('clients/{client}', [ClientController::class, 'update'])->middleware('permission:edit clients');
Route::patch('clients/{client}', [ClientController::class, 'update'])->middleware('permission:edit clients');
Route::delete('clients/{client}', [ClientController::class, 'destroy'])->middleware('permission:delete clients');
