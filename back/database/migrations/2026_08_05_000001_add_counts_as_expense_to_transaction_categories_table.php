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
            $table->boolean('counts_as_expense')->default(true)->after('is_active');
        });

        // The flag only means something for non-system expense categories —
        // income rows and system rows (Achat/Transfert, already excluded from
        // the KPI by is_system) should read as "not applicable", not "on".
        DB::table('transaction_categories')
            ->where(function ($query) {
                $query->where('type', 'income')->orWhere('is_system', true);
            })
            ->update(['counts_as_expense' => false]);

        // 'Produit' (expense) is money paid manually to suppliers via Cash
        // Flow — merchandise cost, the manual counterpart of the system
        // 'Achat' category. Counting it in "Dépenses" double-deducts it,
        // since purchase cost is already baked into gross margin.
        // 'Ahmed' is a person's name mistakenly used as a category. Neither
        // belongs in the Dépenses / Marge Nette KPI.
        DB::table('transaction_categories')
            ->where('type', 'expense')
            ->whereNull('parent_id')
            ->whereIn('name', ['Produit', 'Ahmed'])
            ->update(['counts_as_expense' => false]);

        // Rename the expense 'Produit' category to avoid confusion with the
        // income 'Produit' category, and propagate the rename to the
        // transactions that reference it by name (no FK — category is a
        // plain string column).
        $alreadyExists = DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('name', 'Achat marchandise')->exists();

        if (! $alreadyExists) {
            DB::table('transaction_categories')
                ->where('type', 'expense')->whereNull('parent_id')
                ->where('name', 'Produit')
                ->update(['name' => 'Achat marchandise']);

            DB::table('transactions')
                ->where('type', 'expense')
                ->where('category', 'Produit')
                ->update(['category' => 'Achat marchandise']);
        }
    }

    public function down(): void
    {
        DB::table('transaction_categories')
            ->where('type', 'expense')->whereNull('parent_id')
            ->where('name', 'Achat marchandise')
            ->update(['name' => 'Produit']);

        DB::table('transactions')
            ->where('type', 'expense')
            ->where('category', 'Achat marchandise')
            ->update(['category' => 'Produit']);

        Schema::table('transaction_categories', function (Blueprint $table) {
            $table->dropColumn('counts_as_expense');
        });
    }
};
