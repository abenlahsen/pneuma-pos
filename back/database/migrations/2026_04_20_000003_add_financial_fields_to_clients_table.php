<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'credit_limit')) {
                $table->decimal('credit_limit', 12, 2)->nullable()->default(0)->after('notes');
            }
            if (! Schema::hasColumn('clients', 'opening_balance')) {
                $table->decimal('opening_balance', 12, 2)->nullable()->default(0)->after('credit_limit');
            }
            if (! Schema::hasColumn('clients', 'payment_terms_days')) {
                $table->unsignedInteger('payment_terms_days')->nullable()->after('opening_balance');
            }
            if (! Schema::hasColumn('clients', 'default_payment_method')) {
                $table->string('default_payment_method')->nullable()->after('payment_terms_days');
            }
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