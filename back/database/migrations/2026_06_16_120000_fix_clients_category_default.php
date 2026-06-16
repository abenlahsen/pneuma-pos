<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Set a default and fix any existing NULL values.
        // The previous migration was skipped on production because the column
        // already existed, leaving it NOT NULL without a default.
        DB::statement("ALTER TABLE clients MODIFY COLUMN category VARCHAR(32) NOT NULL DEFAULT 'Particulier'");
        DB::statement("UPDATE clients SET category = 'Particulier' WHERE category IS NULL OR category = ''");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE clients MODIFY COLUMN category VARCHAR(32) NOT NULL");
    }
};
