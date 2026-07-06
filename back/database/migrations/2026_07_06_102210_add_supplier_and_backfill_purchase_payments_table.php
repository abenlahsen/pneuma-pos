<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds `supplier_id` to `purchase_payments` and makes `purchase_id` nullable so a
     * single payment can later be split across several purchases (via
     * `purchase_payment_allocations`). Every existing payment row is backfilled with
     * its supplier and a matching allocation so no historical payment is lost.
     */
    public function up(): void
    {
        Schema::table('purchase_payments', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('purchase_id')->constrained('suppliers')->nullOnDelete();
        });

        Schema::table('purchase_payments', function (Blueprint $table) {
            $table->foreignId('purchase_id')->nullable()->change();
        });

        // Backfill: give every existing payment its supplier and a 1:1 allocation
        // record so paid amounts keep matching their original purchase.
        $now = now();

        DB::table('purchase_payments as pp')
            ->join('purchases as p', 'p.id', '=', 'pp.purchase_id')
            ->update(['pp.supplier_id' => DB::raw('p.supplier_id')]);

        $legacyPayments = DB::table('purchase_payments')->whereNotNull('purchase_id')->get(['id', 'purchase_id', 'amount']);

        $allocations = $legacyPayments->map(fn ($payment) => [
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $payment->purchase_id,
            'amount' => $payment->amount,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        foreach (array_chunk($allocations, 500) as $chunk) {
            DB::table('purchase_payment_allocations')->insert($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('purchase_payment_allocations')->truncate();

        Schema::table('purchase_payments', function (Blueprint $table) {
            $table->foreignId('purchase_id')->nullable(false)->change();
        });

        Schema::table('purchase_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
        });
    }
};
