<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The system 'Achat' category (auto-written by every real Purchase
     * payment) and the non-system 'Achat marchandise' category (manual Cash
     * Flow entries, itself renamed from 'Produit' in the previous migration)
     * both represent the same thing: merchandise purchase cost, already
     * excluded from the "Dépenses" KPI. Having two separate labels for one
     * concept is confusing in the Cash Flow list and in Paramètres ›
     * Catégories, so this merges them under a single name: 'Achat marchandise'.
     */
    public function up(): void
    {
        $systemAchatExists = DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('is_system', true)->where('name', 'Achat')
            ->exists();

        if (! $systemAchatExists) {
            return;
        }

        DB::table('transactions')
            ->where('type', 'expense')->where('category', 'Achat')
            ->update(['category' => 'Achat marchandise']);

        // The non-system duplicate becomes redundant now that the system row
        // carries the same name — drop it so the catalog has a single entry.
        DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('is_system', false)->where('name', 'Achat marchandise')
            ->delete();

        DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('is_system', true)->where('name', 'Achat')
            ->update(['name' => 'Achat marchandise']);
    }

    /**
     * Best-effort rollback: the transaction-level merge above is lossy (once
     * merged, 'Achat' and 'Achat marchandise' transactions are no longer
     * distinguishable), so this restores the catalog shape without trying to
     * split the merged transactions back apart.
     */
    public function down(): void
    {
        DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('is_system', true)->where('name', 'Achat marchandise')
            ->update(['name' => 'Achat']);

        $duplicateExists = DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('name', 'Achat marchandise')
            ->exists();

        if (! $duplicateExists) {
            DB::table('transaction_categories')->insert([
                'name' => 'Achat marchandise',
                'type' => 'expense',
                'parent_id' => null,
                'is_system' => false,
                'is_active' => true,
                'counts_as_expense' => false,
                'sort_order' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
