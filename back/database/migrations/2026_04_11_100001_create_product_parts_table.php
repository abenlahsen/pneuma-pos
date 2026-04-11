<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_parts', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->primary();
            $table->enum('category', [
                'brakes',
                'lubricants',
                'engine',
                'suspension',
                'filters',
                'electrical',
                'body',
                'other',
            ])->default('other');
            $table->string('oem_reference')->nullable();
            $table->text('compatibility')->nullable();
            $table->timestamps();

            $table->foreign('product_id')
                ->references('id')->on('products')
                ->cascadeOnDelete();

            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_parts');
    }
};
