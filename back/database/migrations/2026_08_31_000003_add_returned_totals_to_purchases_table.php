<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Denormalized running totals of what a purchase's supplier returns
     * (see PurchaseReturnService) have taken back — maintained on every
     * return create/delete so KPI aggregates (PurchaseService::summary(),
     * DashboardKpiService, SupplierService) can subtract them with a plain
     * column instead of a whereHas('returns') on every query.
     */
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->integer('returned_quantity')->default(0)->after('total_quantity');
            $table->decimal('returned_amount', 10, 2)->default(0)->after('net_amount');
        });
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['returned_quantity', 'returned_amount']);
        });
    }
};
