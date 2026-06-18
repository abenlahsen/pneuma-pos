<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE sales SET payment_status = 'NON PAYE' WHERE payment_status = 'NON PAYÉ'");
        DB::statement("UPDATE sales SET payment_status = 'PAYE'     WHERE payment_status = 'PAYÉ'");
    }

    public function down(): void
    {
        // Intentionally irreversible — accented values were inconsistent with other modules.
    }
};
