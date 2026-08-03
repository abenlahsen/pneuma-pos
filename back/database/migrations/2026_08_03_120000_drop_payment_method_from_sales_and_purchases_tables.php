<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The header-level `payment_method` is replaced by an aggregate derived at
     * read time from the operation's actual recorded payments (see the
     * AggregatesPaymentMethods trait), so a single stale header value can no
     * longer contradict the payments actually registered against a sale or
     * purchase.
     */
    public function up(): void
    {
        if (Schema::hasColumn('sales', 'payment_method')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropColumn('payment_method');
            });
        }

        if (Schema::hasColumn('purchases', 'payment_method')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->dropColumn('payment_method');
            });
        }
    }

    /**
     * Recreates the columns as nullable placeholders ONLY — the historical
     * values are not recoverable. They were free-text header codes
     * (ESPECE / VIREMENT / CHEQUE / CARTE / TPE / TRAITE) with no surviving
     * source: the per-payment `method` values use a different, accented
     * vocabulary ("Espèces", "Chèque", …), and an operation may have zero or
     * several payments, so no lossless mapping back to a single header code
     * exists. Rolling back yields a schema-compatible but empty column — the
     * real safety net for this migration is a DB snapshot taken before deploy.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('sales', 'payment_method')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->string('payment_method')->nullable();
            });
        }

        if (! Schema::hasColumn('purchases', 'payment_method')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->string('payment_method')->nullable()->after('payment_status');
            });
        }
    }
};
