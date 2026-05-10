<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('service_order_id')
                  ->constrained('products')->nullOnDelete();
            $table->dropColumn('service_type');
        });
    }

    public function down(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
            $table->string('service_type')->nullable()->after('service_order_id');
        });
    }
};
