<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->decimal('credit_limit', 12, 2)->nullable()->default(0)->after('notes');
            $table->decimal('opening_balance', 12, 2)->nullable()->default(0)->after('credit_limit');
            $table->unsignedInteger('payment_terms_days')->nullable()->after('opening_balance');
            $table->string('default_payment_method')->nullable()->after('payment_terms_days');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn([
                'credit_limit',
                'opening_balance',
                'payment_terms_days',
                'default_payment_method',
            ]);
        });
    }
};