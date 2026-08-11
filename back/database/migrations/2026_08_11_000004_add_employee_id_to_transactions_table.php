<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Links an HR-charge transaction to the employee it was paid to,
            // so per-employee totals survive a `users.name` rename — unlike
            // the plain-text `person` column, which stays required and is
            // still filled in parallel for display consistency with the rest
            // of the Cash Flow table.
            $table->foreignId('employee_id')->nullable()->after('partner_id')
                ->constrained('users')->nullOnDelete();
            $table->index('employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
        });
    }
};
