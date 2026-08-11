<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seeds the confidential 'Charges RH' expense category tree. The parent
     * carries counts_as_expense=true so its children flow into the dashboard
     * "Dépenses" / "Marge Nette" KPIs (via TransactionCategory::expenseKpiNames())
     * exactly like any other expense category — visibility is a separate axis
     * (is_confidential), not a separate accounting path.
     */
    public function up(): void
    {
        $now = now();

        $parentExists = DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('name', 'Charges RH')->exists();

        if ($parentExists) {
            return;
        }

        $parentId = DB::table('transaction_categories')->insertGetId([
            'name' => 'Charges RH',
            'type' => 'expense',
            'parent_id' => null,
            'is_system' => false,
            'is_active' => true,
            'counts_as_expense' => true,
            'counts_as_revenue' => false,
            'is_confidential' => true,
            'sort_order' => 5,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $children = [
            'Salaires',
            'Primes & gratifications',
            'CNSS (part patronale)',
            'CNSS (part salariale)',
            'AMO',
            'IR / IGR',
            'Avances sur salaire',
            'Indemnités & frais de personnel',
        ];

        foreach ($children as $index => $name) {
            DB::table('transaction_categories')->insert([
                'name' => $name,
                'type' => 'expense',
                'parent_id' => $parentId,
                'is_system' => false,
                'is_active' => true,
                'counts_as_expense' => false,
                'counts_as_revenue' => false,
                'is_confidential' => false,
                'sort_order' => $index,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $parent = DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('name', 'Charges RH')->first();

        if (! $parent) {
            return;
        }

        DB::table('transaction_categories')->where('parent_id', $parent->id)->delete();
        DB::table('transaction_categories')->where('id', $parent->id)->delete();
    }
};
