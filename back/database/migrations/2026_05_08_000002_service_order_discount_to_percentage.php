<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Existing absolute discount values cannot be converted to percentage —
        // reset to 0% and recalculate net_amount accordingly.
        DB::table('service_orders')->update([
            'discount'   => 0,
            'net_amount' => DB::raw('total_amount'),
        ]);
    }

    public function down(): void
    {
        // Irreversible data change — no-op on rollback.
    }
};
