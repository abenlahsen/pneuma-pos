<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->enum('item_type', ['service', 'part'])
                  ->default('service')
                  ->after('service_order_id');

            $table->string('service_type')->nullable()->after('item_type');

            $table->integer('quantity')->default(1)->after('product_id');

            $table->decimal('unit_price', 10, 2)->default(0)->after('quantity');

            $table->foreignId('stock_id')
                  ->nullable()
                  ->after('unit_price')
                  ->constrained('stocks')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_items', function (Blueprint $table) {
            $table->dropForeign(['stock_id']);
            $table->dropColumn(['item_type', 'service_type', 'quantity', 'unit_price', 'stock_id']);
        });
    }
};
