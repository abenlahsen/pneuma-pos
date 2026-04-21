<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'client_phone')) {
                $table->dropColumn('client_phone');
            }

            if (Schema::hasColumn('sales', 'client')) {
                $table->dropColumn('client');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (! Schema::hasColumn('sales', 'client')) {
                $table->string('client')->nullable()->after('service_fee');
            }

            if (! Schema::hasColumn('sales', 'client_phone')) {
                $table->string('client_phone', 50)->nullable()->after('client');
            }
        });
    }
};
