<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE clients SET category = 'Particulier' WHERE category = 'Paticulier'");
    }

    public function down(): void
    {
        // Intentionally irreversible — the old value was a typo.
    }
};
