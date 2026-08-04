<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['income', 'expense']);
            $table->foreignId('parent_id')->nullable()->constrained('transaction_categories')->cascadeOnDelete();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['type', 'parent_id']);
        });

        $now = now();

        // System categories, auto-created by application code (never picked
        // by hand) — kept in the catalog so the dashboard "Dépenses" KPI and
        // the management screen stay consistent, but locked from edit/delete.
        DB::table('transaction_categories')->insert([
            ['name' => 'Produit', 'type' => 'income', 'parent_id' => null, 'is_system' => true, 'is_active' => true, 'sort_order' => 0, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Achat', 'type' => 'expense', 'parent_id' => null, 'is_system' => true, 'is_active' => true, 'sort_order' => 0, 'created_at' => $now, 'updated_at' => $now],
            // One row per leg — AccountService::transfer() creates both an income and an expense transaction, each tagged 'Transfert'.
            ['name' => 'Transfert', 'type' => 'income', 'parent_id' => null, 'is_system' => true, 'is_active' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Transfert', 'type' => 'expense', 'parent_id' => null, 'is_system' => true, 'is_active' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Clean defaults for the manually-picked expense categories already used across the app.
        DB::table('transaction_categories')->insert([
            ['name' => 'Charge', 'type' => 'expense', 'parent_id' => null, 'is_system' => false, 'is_active' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Transport', 'type' => 'expense', 'parent_id' => null, 'is_system' => false, 'is_active' => true, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Service', 'type' => 'expense', 'parent_id' => null, 'is_system' => false, 'is_active' => true, 'sort_order' => 4, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Data backfill: import any other distinct category already used on a
        // real transaction, so nothing that was actually in use is silently
        // dropped once the create/edit form starts validating against this
        // catalog. Category values that only ever existed as dead <option>
        // entries in the old hardcoded dropdown (and were never saved) are
        // not imported — they simply never appear in `transactions`.
        if (Schema::hasTable('transactions')) {
            $existing = DB::table('transaction_categories')->pluck('name', 'type')->all();
            $seeded = [];
            foreach (DB::table('transaction_categories')->select('name', 'type')->get() as $row) {
                $seeded[$row->type][$row->name] = true;
            }

            $distinct = DB::table('transactions')
                ->select('category', 'type')
                ->whereNotNull('category')
                ->where('category', '!=', '')
                ->distinct()
                ->get();

            $sortOrder = 100;
            foreach ($distinct as $row) {
                if (! empty($seeded[$row->type][$row->category])) {
                    continue;
                }

                DB::table('transaction_categories')->insert([
                    'name' => $row->category,
                    'type' => $row->type,
                    'parent_id' => null,
                    'is_system' => false,
                    'is_active' => true,
                    'sort_order' => $sortOrder++,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $seeded[$row->type][$row->category] = true;
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_categories');
    }
};
