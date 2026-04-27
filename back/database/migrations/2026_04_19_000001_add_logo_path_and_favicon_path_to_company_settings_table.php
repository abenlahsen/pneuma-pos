<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('company_settings', 'logo_path')) {
                $table->string('logo_path')->nullable()->after('patente');
            }
            if (! Schema::hasColumn('company_settings', 'favicon_path')) {
                $table->string('favicon_path')->nullable()->after('logo_path');
            }
        });

        if (Schema::hasColumn('company_settings', 'logo_url')) {
            DB::table('company_settings')
                ->whereNotNull('logo_url')
                ->update([
                    'logo_path' => DB::raw('logo_url'),
                ]);

            Schema::table('company_settings', function (Blueprint $table) {
                $table->dropColumn('logo_url');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('logo_url')->nullable()->after('patente');
        });

        DB::table('company_settings')
            ->whereNotNull('logo_path')
            ->update([
                'logo_url' => DB::raw('logo_path'),
            ]);

        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['logo_path', 'favicon_path']);
        });
    }
};