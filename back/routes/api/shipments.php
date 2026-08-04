<?php

use App\Http\Controllers\ShipmentChangeRequestController;
use Illuminate\Support\Facades\Route;

// Shipment change requests (demandes de modification d'expédition)
Route::middleware('permission:view shipment-changes')->group(function () {
    Route::get('shipment-change-requests', [ShipmentChangeRequestController::class, 'index']);
    Route::get('sales/{sale}/shipment-change-requests', [ShipmentChangeRequestController::class, 'forSale']);
    Route::get('shipment-change-requests/{shipmentChangeRequest}', [ShipmentChangeRequestController::class, 'show']);
});

Route::post('sales/{sale}/shipment-change-requests', [ShipmentChangeRequestController::class, 'store'])
    ->middleware('permission:create shipment-changes');

Route::put('shipment-change-requests/{shipmentChangeRequest}', [ShipmentChangeRequestController::class, 'update'])
    ->middleware('permission:edit shipment-changes');

Route::patch('shipment-change-requests/{shipmentChangeRequest}/status', [ShipmentChangeRequestController::class, 'updateStatus'])
    ->middleware('permission:edit shipment-changes');

Route::delete('shipment-change-requests/{shipmentChangeRequest}', [ShipmentChangeRequestController::class, 'destroy'])
    ->middleware('permission:delete shipment-changes');
