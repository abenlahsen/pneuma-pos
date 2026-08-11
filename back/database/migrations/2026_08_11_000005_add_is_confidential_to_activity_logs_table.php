<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            // Materialized at write time by ActivityLogService whenever a
            // transaction's category (before or after) belongs to a
            // confidential category tree (e.g. 'Charges RH') — mirrors
            // Transaction::scopeVisible() so the Journal d'activité can't
            // leak payroll data to a user with `view activity-log` but not
            // `view hr-charges`. See ActivityLogController::index()/filters().
            $table->boolean('is_confidential')->default(false)->after('entity_type')->index();
        });

        // Backfill: existing 'transaction' log entries whose snapshot
        // category (before or after) is currently flagged confidential.
        $names = DB::table('transaction_categories')
            ->whereNull('parent_id')
            ->where('is_confidential', true)
            ->pluck('name')
            ->all();

        if ($names !== []) {
            $placeholders = implode(',', array_fill(0, count($names), '?'));

            DB::table('activity_logs')
                ->where('entity_type', 'transaction')
                ->where(function ($query) use ($names, $placeholders) {
                    $query->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(properties, '$.after.category')) IN ({$placeholders})", $names)
                        ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(properties, '$.before.category')) IN ({$placeholders})", $names);
                })
                ->update(['is_confidential' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropColumn('is_confidential');
        });
    }
};
