<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_tyres', function (Blueprint $table) {
            $table->decimal('tire_diameter', 4, 1)->unsigned()->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('product_tyres', function (Blueprint $table) {
            $table->smallInteger('tire_diameter')->unsigned()->nullable()->change();
        });
    }
};
