<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_services', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->primary();
            $table->enum('category', [
                'mechanical',
                'oil',
                'tires',
                'bodywork',
                'diagnostic',
                'other',
            ])->default('other');
            $table->smallInteger('duration_minutes')->unsigned()->nullable();
            // Default selling price for pre-filling sale lines (services have no stock)
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->timestamps();

            $table->foreign('product_id')
                ->references('id')->on('products')
                ->cascadeOnDelete();

            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_services');
    }
};
