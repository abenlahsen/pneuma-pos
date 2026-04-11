<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add nullable account_id and transfer_id columns
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('user_id')->constrained('accounts')->cascadeOnDelete();
            $table->uuid('transfer_id')->nullable()->after('account_id')->index();
        });

        // 2. Create the default "Caisse" account
        $accountId = DB::table('accounts')->insertGetId([
            'name' => 'Caisse',
            'type' => 'cash',
            'description' => 'Compte de caisse principal',
            'initial_balance' => 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Assign all existing transactions to the Caisse account
        DB::table('transactions')->whereNull('account_id')->update(['account_id' => $accountId]);

        // 4. Make account_id NOT NULL
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['account_id']);
            $table->dropColumn(['account_id', 'transfer_id']);
        });
    }
};
