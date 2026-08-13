<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Trims the 8 'Charges RH' subcategories seeded by
     * 2026_08_11_000002_seed_charges_rh_categories.php down to the 5 the
     * business actually uses day to day: Salaire, CNSS, Prime, Avance sur
     * salaire, Indemnités & frais de personnel. `transactions.subcategory`
     * stores the category *name* (not a FK — see UpdateHrChargeRequest's
     * Rule::in() built from TransactionCategory names), so every rename or
     * merge below updates both the transaction_categories row and any
     * existing 'Charges RH' transactions that reference it, in the same
     * pass, to keep them in sync.
     */
    public function up(): void
    {
        DB::transaction(function () {
            $parent = DB::table('transaction_categories')
                ->where('type', 'expense')->whereNull('parent_id')
                ->where('name', 'Charges RH')->first();

            if (! $parent) {
                return;
            }

            // name => new name
            $renames = [
                'Salaires' => 'Salaire',
                'Primes & gratifications' => 'Prime',
                'CNSS (part patronale)' => 'CNSS',
                'Avances sur salaire' => 'Avance sur salaire',
            ];

            foreach ($renames as $from => $to) {
                $this->renameOrMergeSubcategory($parent->id, $from, $to);
            }

            // These are folded into 'CNSS' (renamed above, or already present).
            foreach (['CNSS (part salariale)', 'AMO', 'IR / IGR'] as $from) {
                $this->renameOrMergeSubcategory($parent->id, $from, 'CNSS');
            }

            $order = ['Salaire' => 0, 'CNSS' => 1, 'Prime' => 2, 'Avance sur salaire' => 3, 'Indemnités & frais de personnel' => 4];
            foreach ($order as $name => $sortOrder) {
                DB::table('transaction_categories')
                    ->where('parent_id', $parent->id)->where('name', $name)
                    ->update(['sort_order' => $sortOrder, 'updated_at' => now()]);
            }
        });
    }

    /**
     * Renames a child category to $to. If a category named $to already
     * exists under the same parent (e.g. from a prior manual cleanup, or
     * because a previous iteration of this loop already created it), the
     * transactions are reassigned to that existing row and the now-empty
     * $from row is deleted instead — avoids ever creating a duplicate
     * category name under the same parent.
     */
    private function renameOrMergeSubcategory(int $parentId, string $from, string $to): void
    {
        $fromRow = DB::table('transaction_categories')
            ->where('parent_id', $parentId)->where('name', $from)->first();

        if (! $fromRow) {
            return;
        }

        $existingTarget = DB::table('transaction_categories')
            ->where('parent_id', $parentId)->where('name', $to)->first();

        DB::table('transactions')
            ->where('category', 'Charges RH')->where('subcategory', $from)
            ->update(['subcategory' => $to, 'updated_at' => now()]);

        if ($existingTarget && $existingTarget->id !== $fromRow->id) {
            DB::table('transaction_categories')->where('id', $fromRow->id)->delete();

            return;
        }

        DB::table('transaction_categories')->where('id', $fromRow->id)
            ->update(['name' => $to, 'updated_at' => now()]);
    }

    /**
     * Restores the 8 original subcategory names. The individual
     * transactions that were merged into 'CNSS' from 'CNSS (part
     * salariale)', 'AMO', or 'IR / IGR' cannot be told apart anymore — they
     * all come back tagged 'CNSS (part patronale)'. This is a best-effort
     * rollback, not a lossless one.
     */
    public function down(): void
    {
        DB::transaction(function () {
            $parent = DB::table('transaction_categories')
                ->where('type', 'expense')->whereNull('parent_id')
                ->where('name', 'Charges RH')->first();

            if (! $parent) {
                return;
            }

            $renamesBack = [
                'Salaire' => 'Salaires',
                'Prime' => 'Primes & gratifications',
                'CNSS' => 'CNSS (part patronale)',
                'Avance sur salaire' => 'Avances sur salaire',
            ];

            foreach ($renamesBack as $from => $to) {
                DB::table('transactions')
                    ->where('category', 'Charges RH')->where('subcategory', $from)
                    ->update(['subcategory' => $to, 'updated_at' => now()]);

                DB::table('transaction_categories')
                    ->where('parent_id', $parent->id)->where('name', $from)
                    ->update(['name' => $to, 'updated_at' => now()]);
            }

            $now = now();
            $recreated = [
                'CNSS (part salariale)' => 4,
                'AMO' => 5,
                'IR / IGR' => 6,
            ];
            foreach ($recreated as $name => $sortOrder) {
                $exists = DB::table('transaction_categories')
                    ->where('parent_id', $parent->id)->where('name', $name)->exists();

                if (! $exists) {
                    DB::table('transaction_categories')->insert([
                        'name' => $name,
                        'type' => 'expense',
                        'parent_id' => $parent->id,
                        'is_system' => false,
                        'is_active' => true,
                        'counts_as_expense' => false,
                        'counts_as_revenue' => false,
                        'is_confidential' => false,
                        'sort_order' => $sortOrder,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            $order = [
                'Salaires' => 0, 'Primes & gratifications' => 1, 'CNSS (part patronale)' => 2,
                'CNSS (part salariale)' => 3, 'AMO' => 4, 'IR / IGR' => 5,
                'Avances sur salaire' => 6, 'Indemnités & frais de personnel' => 7,
            ];
            foreach ($order as $name => $sortOrder) {
                DB::table('transaction_categories')
                    ->where('parent_id', $parent->id)->where('name', $name)
                    ->update(['sort_order' => $sortOrder, 'updated_at' => now()]);
            }
        });
    }
};
