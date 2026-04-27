<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('company_settings', 'theme_mode')) {
                $table->string('theme_mode')->default('system')->after('favicon_path');
            }
            if (! Schema::hasColumn('company_settings', 'primary_color')) {
                $table->string('primary_color', 7)->default('#ff2d37')->after('theme_mode');
            }
            if (! Schema::hasColumn('company_settings', 'accent_color')) {
                $table->string('accent_color', 7)->default('#1e293b')->after('primary_color');
            }
            if (! Schema::hasColumn('company_settings', 'surface_color')) {
                $table->string('surface_color', 7)->default('#ffffff')->after('accent_color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn([
                'theme_mode',
                'primary_color',
                'accent_color',
                'surface_color',
            ]);
        });
    }
};
