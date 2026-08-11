<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            // Top-level categories flagged confidential (e.g. 'Charges RH') are
            // excluded from every transaction read (list/summary/filters) and
            // from the category picker for users without the `view hr-charges`
            // permission — see Transaction::scopeVisible() and
            // TransactionCategory::confidentialNames().
            $table->boolean('is_confidential')->default(false)->after('counts_as_revenue');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropColumn('is_confidential');
        });
    }
};
