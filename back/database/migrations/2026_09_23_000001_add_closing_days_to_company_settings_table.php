<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2b, 9b — when the shop is closed.
 *
 * Nothing recorded this before, which is what kept the Primes projection
 * masked: "how many tyres per remaining working day" cannot be answered
 * without knowing which days are working days.
 *
 * Two columns rather than one calendar table: the weekly rhythm almost never
 * changes and the exceptions are few, so a pair of JSON lists is the right
 * weight. `closed_weekdays` holds 0 (Sunday) to 6 (Saturday), matching
 * JavaScript's Date#getDay so the front needs no translation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->json('closed_weekdays')->nullable()->after('prime_threshold');
            $table->json('holidays')->nullable()->after('closed_weekdays');
        });

        // Both columns are nullable rather than carrying a SQL default: the
        // "closed on Sunday" default is applied by the model, so the row that
        // already exists reads as [0] / [] without a data migration.
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['closed_weekdays', 'holidays']);
        });
    }
};
