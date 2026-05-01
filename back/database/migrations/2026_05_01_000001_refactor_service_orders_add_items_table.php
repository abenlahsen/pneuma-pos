<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_order_id')->constrained('service_orders')->cascadeOnDelete();
            $table->string('service_type');
            $table->text('description')->nullable();
            $table->decimal('parts_cost', 10, 2)->default(0);
            $table->decimal('labor_cost', 10, 2)->default(0);
            $table->decimal('line_total', 10, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        $columnsToDrop = array_filter(
            ['service_type', 'description', 'parts_cost', 'labor_cost'],
            fn (string $col) => Schema::hasColumn('service_orders', $col)
        );

        if (!empty($columnsToDrop)) {
            Schema::table('service_orders', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn(array_values($columnsToDrop));
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('service_items');

        Schema::table('service_orders', function (Blueprint $table) {
            $table->string('service_type', 100)->nullable();
            $table->text('description')->nullable();
            $table->decimal('parts_cost', 10, 2)->default(0);
            $table->decimal('labor_cost', 10, 2)->default(0);
        });
    }
};
