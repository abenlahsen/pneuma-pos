<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['sales_rep_id']);
            $table->renameColumn('sales_rep_id', 'commercial_id');
            $table->foreign('commercial_id')->references('id')->on('personnels')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['commercial_id']);
            $table->renameColumn('commercial_id', 'sales_rep_id');
            $table->foreign('sales_rep_id')->references('id')->on('sales_reps')->nullOnDelete();
        });
    }
};
