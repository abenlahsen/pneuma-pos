<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_tyres', function (Blueprint $table) {
            $table->decimal('tire_width', 4, 1)->unsigned()->nullable()->change();
            $table->decimal('tire_height', 4, 1)->unsigned()->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('product_tyres', function (Blueprint $table) {
            $table->smallInteger('tire_width')->unsigned()->nullable()->change();
            $table->smallInteger('tire_height')->unsigned()->nullable()->change();
        });
    }
};
