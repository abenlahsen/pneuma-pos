<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->rename('Produit', 'Vente marchandise');
    }

    public function down(): void
    {
        $this->rename('Vente marchandise', 'Produit');
    }

    /**
     * Rename the system 'income' category and cascade the change to every
     * transaction referencing it by name — `transactions.category` has no
     * FK, it's a plain string column.
     */
    private function rename(string $from, string $to): void
    {
        $alreadyDone = DB::table('transaction_categories')
            ->where('type', 'income')->whereNull('parent_id')
            ->where('name', $to)->exists();

        if ($alreadyDone) {
            return;
        }

        DB::table('transaction_categories')
            ->where('type', 'income')->whereNull('parent_id')
            ->where('name', $from)
            ->update(['name' => $to]);

        DB::table('transactions')
            ->where('type', 'income')
            ->where('category', $from)
            ->update(['category' => $to]);
    }
};
