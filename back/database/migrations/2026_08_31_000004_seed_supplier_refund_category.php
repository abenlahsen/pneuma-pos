<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * 'Remboursement fournisseur' is written by PurchaseReturnService when a
     * supplier return is refunded in cash — an income transaction offsetting
     * an earlier 'Achat marchandise' expense. Seeded as a system category
     * (auto-created by app code, not picked by hand) so it exists for
     * StoreTransactionRequest's category-exists validation the moment a user
     * edits it later from Cash Flow. counts_as_revenue stays false: it is
     * money coming back, not new sales revenue, and must not inflate the
     * dashboard CA/Marge Brute KPIs.
     */
    public function up(): void
    {
        $exists = DB::table('transaction_categories')
            ->where('type', 'income')->whereNull('parent_id')
            ->where('name', 'Remboursement fournisseur')->exists();

        if ($exists) {
            return;
        }

        $now = now();
        DB::table('transaction_categories')->insert([
            'name' => 'Remboursement fournisseur',
            'type' => 'income',
            'parent_id' => null,
            'is_system' => true,
            'is_active' => true,
            'counts_as_expense' => false,
            'counts_as_revenue' => false,
            'is_confidential' => false,
            'sort_order' => 6,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('transaction_categories')
            ->where('type', 'income')->whereNull('parent_id')
            ->where('name', 'Remboursement fournisseur')
            ->delete();
    }
};
