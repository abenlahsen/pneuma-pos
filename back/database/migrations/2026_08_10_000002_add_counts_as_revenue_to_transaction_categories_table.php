<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            // Default false — unlike counts_as_expense (default true). A new
            // income category is most often created to record payment against
            // a sale/service order that is already counted via `sales`/
            // `service_orders`; auto-including it in the dashboard KPI would
            // double-count that revenue. Opt-in is the safe default here.
            $table->boolean('counts_as_revenue')->default(false)->after('counts_as_expense');
        });

        // Existing non-system income categories are cash-flow revenue with no
        // linked Sale/ServiceOrder (e.g. 'Occasion', 'Service') — 100% margin,
        // currently invisible in CA / Marge Brute / Marge Nette. System
        // categories ('Vente marchandise', 'Transfert') stay excluded: they
        // already back a Sale/ServiceOrder payment or an internal transfer.
        DB::table('transaction_categories')
            ->where('type', 'income')
            ->whereNull('parent_id')
            ->where('is_system', false)
            ->update(['counts_as_revenue' => true]);
    }

    public function down(): void
    {
        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropColumn('counts_as_revenue');
        });
    }
};
