<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('method', 50)->nullable()->after('category');
        });

        $driver = DB::connection()->getDriverName();

        // Backfill method from linked sale/purchase payments
        if (Schema::hasTable('payments')) {
            if ($driver === 'sqlite') {
                DB::table('payments')
                    ->select(['transaction_id', 'method'])
                    ->whereNotNull('transaction_id')
                    ->whereNotNull('method')
                    ->get()
                    ->each(function ($payment) {
                        DB::table('transactions')
                            ->where('id', $payment->transaction_id)
                            ->update(['method' => $payment->method]);
                    });
            } else {
                DB::statement('UPDATE transactions t JOIN payments p ON p.transaction_id = t.id SET t.method = p.method WHERE p.method IS NOT NULL');
            }
        }

        if (Schema::hasTable('purchase_payments')) {
            if ($driver === 'sqlite') {
                DB::table('purchase_payments')
                    ->select(['transaction_id', 'method'])
                    ->whereNotNull('transaction_id')
                    ->whereNotNull('method')
                    ->get()
                    ->each(function ($payment) {
                        DB::table('transactions')
                            ->where('id', $payment->transaction_id)
                            ->update(['method' => $payment->method]);
                    });
            } else {
                DB::statement('UPDATE transactions t JOIN purchase_payments pp ON pp.transaction_id = t.id SET t.method = pp.method WHERE pp.method IS NOT NULL');
            }
        }

        // Transfers are always virement
        DB::table('transactions')
            ->whereNotNull('transfer_id')
            ->whereNull('method')
            ->update(['method' => 'Virement']);
    }

    public function down()
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('method');
        });
    }
};
