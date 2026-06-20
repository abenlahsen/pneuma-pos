<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->decimal('purchase_price', 10, 2)->default(0)->after('unit_price');
        });

        Schema::table('service_orders', function (Blueprint $table) {
            $table->decimal('total_purchase', 12, 2)->default(0)->after('total_amount');
            $table->decimal('margin', 10, 2)->default(0)->after('total_purchase');
        });
    }

    public function down(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->dropColumn('purchase_price');
        });

        Schema::table('service_orders', function (Blueprint $table) {
            $table->dropColumn(['total_purchase', 'margin']);
        });
    }
};
