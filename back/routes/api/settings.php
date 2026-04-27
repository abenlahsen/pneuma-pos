<?php

use App\Http\Controllers\CompanySettingsController;
use Illuminate\Support\Facades\Route;

Route::get('settings/company', [CompanySettingsController::class, 'show'])
    ->middleware('permission:view settings');

Route::put('settings/company', [CompanySettingsController::class, 'update'])
    ->middleware('permission:edit settings');

// POST alias for multipart/form-data uploads (method spoofing via _method=PUT)
Route::post('settings/company', [CompanySettingsController::class, 'update'])
    ->middleware('permission:edit settings');