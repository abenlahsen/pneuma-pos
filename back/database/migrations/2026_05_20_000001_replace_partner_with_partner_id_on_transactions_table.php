<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedBigInteger('partner_id')->nullable()->after('person');
            $table->foreign('partner_id')->references('id')->on('partners')->nullOnDelete();
        });

        // Migrate existing text values to FK where the name matches a partner
        DB::statement("
            UPDATE transactions t
            JOIN partners p ON p.name = t.partner
            SET t.partner_id = p.id
            WHERE t.partner IS NOT NULL AND t.partner != ''
        ");

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('partner');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('partner')->nullable()->after('person');
        });

        DB::statement('
            UPDATE transactions t
            JOIN partners p ON p.id = t.partner_id
            SET t.partner = p.name
            WHERE t.partner_id IS NOT NULL
        ');

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['partner_id']);
            $table->dropColumn('partner_id');
        });
    }
};
