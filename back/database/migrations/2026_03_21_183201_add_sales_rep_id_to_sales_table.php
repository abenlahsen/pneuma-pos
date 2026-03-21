<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('sales_rep');
            $table->foreignId('sales_rep_id')->nullable()->constrained('sales_reps')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['sales_rep_id']);
            $table->dropColumn('sales_rep_id');
            $table->string('sales_rep')->nullable();
        });
    }
};
