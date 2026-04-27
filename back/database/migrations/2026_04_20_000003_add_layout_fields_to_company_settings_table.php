<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('company_settings', 'menu_layout')) {
                $table->string('menu_layout')->default('vertical')->after('surface_color');
            }
            if (! Schema::hasColumn('company_settings', 'navbar_variant')) {
                $table->string('navbar_variant')->default('default')->after('menu_layout');
            }
            if (! Schema::hasColumn('company_settings', 'content_width')) {
                $table->string('content_width')->default('full')->after('navbar_variant');
            }
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
