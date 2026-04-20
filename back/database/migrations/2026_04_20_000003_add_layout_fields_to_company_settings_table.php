<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('menu_layout')->default('vertical')->after('surface_color');
            $table->string('navbar_variant')->default('default')->after('menu_layout');
            $table->string('content_width')->default('full')->after('navbar_variant');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn([
                'menu_layout',
                'navbar_variant',
                'content_width',
            ]);
        });
    }
};
