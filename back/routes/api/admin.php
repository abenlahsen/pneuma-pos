<?php

use App\Http\Controllers\PermissionController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Admin dashboard KPI snapshot
Route::get('/dashboard-kpi', [\App\Http\Controllers\DashboardController::class, 'kpi'])
    ->middleware('role:Administrator');

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

// Users management
Route::get('users', [UserController::class, 'index'])->middleware('permission:view users');
Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:view users');
Route::post('users', [UserController::class, 'store'])->middleware('permission:create users');
Route::put('users/{user}', [UserController::class, 'update'])->middleware('permission:edit users');
Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:delete users');