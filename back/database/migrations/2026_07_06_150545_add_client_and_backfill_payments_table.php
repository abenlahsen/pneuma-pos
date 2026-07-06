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
     * Adds `client_id` to `payments` and makes `sale_id` nullable so a single
     * payment can later be split across several sales (via
     * `sale_payment_allocations`). Every existing payment row is backfilled with
     * its client and a matching allocation so no historical payment is lost.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('sale_id')->constrained('clients')->nullOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable()->change();
        });

        $now = now();

        DB::table('payments as p')
            ->join('sales as s', 's.id', '=', 'p.sale_id')
            ->update(['p.client_id' => DB::raw('s.client_id')]);

        $legacyPayments = DB::table('payments')->whereNotNull('sale_id')->get(['id', 'sale_id', 'amount']);

        $allocations = $legacyPayments->map(fn ($payment) => [
            'payment_id' => $payment->id,
            'sale_id' => $payment->sale_id,
            'amount' => $payment->amount,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        foreach (array_chunk($allocations, 500) as $chunk) {
            DB::table('sale_payment_allocations')->insert($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('sale_payment_allocations')->truncate();

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable(false)->change();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
        });
    }
};
