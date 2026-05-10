<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_orders', function (Blueprint $table) {
            if (Schema::hasColumn('service_orders', 'client')) {
                $table->dropColumn('client');
            }

            if (Schema::hasColumn('service_orders', 'phone')) {
                $table->dropColumn('phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('service_orders', 'client')) {
                $table->string('client')->default('')->after('date');
            }

            if (! Schema::hasColumn('service_orders', 'phone')) {
                $table->string('phone', 50)->nullable()->after('client');
            }
        });
    }
};
