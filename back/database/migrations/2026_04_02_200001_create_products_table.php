<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('profile')->nullable();
            $table->string('reference')->nullable();
            $table->enum('type', ['tyre', 'part']);
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->decimal('special_selling_price', 10, 2)->nullable();
            $table->string('unit', 50)->default('piece');
            $table->boolean('is_active')->default(true);

            // Tyre-specific attributes
            $table->smallInteger('tire_width')->unsigned()->nullable();
            $table->smallInteger('tire_height')->unsigned()->nullable();
            $table->smallInteger('tire_diameter')->unsigned()->nullable();
            $table->string('tire_load_index', 20)->nullable();
            $table->string('tire_speed_index', 10)->nullable();
            $table->enum('tire_season', ['summer', 'winter', 'all_season'])->nullable();
            $table->boolean('tire_runflat')->default(false);
            $table->boolean('tire_reinforced')->default(false);
            $table->string('tire_marking')->nullable();

            // EU tyre label
            $table->char('eu_fuel', 1)->nullable();         // A-G
            $table->char('eu_wet_grip', 1)->nullable();      // A-G
            $table->smallInteger('eu_noise_db')->unsigned()->nullable();
            $table->char('eu_noise_class', 1)->nullable();   // A, B or C

            $table->timestamps();

            $table->index('type');
            $table->index('brand_id');
            $table->index('reference');
        });

        // Add product_id and stock_id to purchases and make product nullable
        Schema::table('purchases', function (Blueprint $table) {
            $table->string('product')->nullable()->change();
            $table->unsignedBigInteger('product_id')->nullable()->after('product');
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->unsignedBigInteger('stock_id')->nullable()->after('product_id');
            $table->foreign('stock_id')->references('id')->on('stocks')->nullOnDelete();
        });

        // Add product_id and stock_id to sales
        Schema::table('sales', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->after('profile');
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->unsignedBigInteger('stock_id')->nullable()->after('product_id');
            $table->foreign('stock_id')->references('id')->on('stocks')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'stock_id')) {
                $table->dropForeign(['stock_id']);
                $table->dropColumn('stock_id');
            }
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
        Schema::table('purchases', function (Blueprint $table) {
            if (Schema::hasColumn('purchases', 'stock_id')) {
                $table->dropForeign(['stock_id']);
                $table->dropColumn('stock_id');
            }
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
            $table->string('product')->nullable(false)->change();
        });
        Schema::dropIfExists('products');
    }
};
