<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_payments', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('method')
                ->constrained('accounts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_payments', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Account::class);
            $table->dropColumn('account_id');
        });
    }
};
