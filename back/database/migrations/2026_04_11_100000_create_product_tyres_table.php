<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('product_tyres', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->primary();
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
            $table->char('eu_fuel', 1)->nullable();
            $table->char('eu_wet_grip', 1)->nullable();
            $table->smallInteger('eu_noise_db')->unsigned()->nullable();
            $table->char('eu_noise_class', 1)->nullable();

            $table->timestamps();

            $table->foreign('product_id')
                ->references('id')->on('products')
                ->cascadeOnDelete();
        });

        // Backfill existing tyre products into the new sub-table
        DB::statement("
            INSERT INTO product_tyres (
                product_id,
                tire_width, tire_height, tire_diameter,
                tire_load_index, tire_speed_index, tire_season,
                tire_runflat, tire_reinforced, tire_marking,
                eu_fuel, eu_wet_grip, eu_noise_db, eu_noise_class,
                created_at, updated_at
            )
            SELECT
                id,
                tire_width, tire_height, tire_diameter,
                tire_load_index, tire_speed_index, tire_season,
                tire_runflat, tire_reinforced, tire_marking,
                eu_fuel, eu_wet_grip, eu_noise_db, eu_noise_class,
                created_at, updated_at
            FROM products
            WHERE type = 'tyre'
        ");

        // Drop the migrated columns from base products
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'tire_width',
                'tire_height',
                'tire_diameter',
                'tire_load_index',
                'tire_speed_index',
                'tire_season',
                'tire_runflat',
                'tire_reinforced',
                'tire_marking',
                'eu_fuel',
                'eu_wet_grip',
                'eu_noise_db',
                'eu_noise_class',
            ]);
        });
    }

    public function down()
    {
        // Restore columns on products
        Schema::table('products', function (Blueprint $table) {
            $table->smallInteger('tire_width')->unsigned()->nullable();
            $table->smallInteger('tire_height')->unsigned()->nullable();
            $table->smallInteger('tire_diameter')->unsigned()->nullable();
            $table->string('tire_load_index', 20)->nullable();
            $table->string('tire_speed_index', 10)->nullable();
            $table->enum('tire_season', ['summer', 'winter', 'all_season'])->nullable();
            $table->boolean('tire_runflat')->default(false);
            $table->boolean('tire_reinforced')->default(false);
            $table->string('tire_marking')->nullable();
            $table->char('eu_fuel', 1)->nullable();
            $table->char('eu_wet_grip', 1)->nullable();
            $table->smallInteger('eu_noise_db')->unsigned()->nullable();
            $table->char('eu_noise_class', 1)->nullable();
        });

        // Copy data back
        DB::statement("
            UPDATE products p
            INNER JOIN product_tyres pt ON pt.product_id = p.id
            SET
                p.tire_width = pt.tire_width,
                p.tire_height = pt.tire_height,
                p.tire_diameter = pt.tire_diameter,
                p.tire_load_index = pt.tire_load_index,
                p.tire_speed_index = pt.tire_speed_index,
                p.tire_season = pt.tire_season,
                p.tire_runflat = pt.tire_runflat,
                p.tire_reinforced = pt.tire_reinforced,
                p.tire_marking = pt.tire_marking,
                p.eu_fuel = pt.eu_fuel,
                p.eu_wet_grip = pt.eu_wet_grip,
                p.eu_noise_db = pt.eu_noise_db,
                p.eu_noise_class = pt.eu_noise_class
        ");

        Schema::dropIfExists('product_tyres');
    }
};
