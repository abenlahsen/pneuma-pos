<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * RETOUR is being retired from the purchase status workflow (folded into
     * ANNULE — both are "did not complete normally" terminal outcomes).
     * Convert any existing rows before the enum stops accepting the value.
     */
    public function up(): void
    {
        DB::table('purchases')->where('status', 'RETOUR')->update(['status' => 'ANNULE']);
    }

    public function down(): void
    {
        // Irreversible by design: once merged into ANNULE, purchases that were
        // originally RETOUR are indistinguishable from purchases that were
        // originally ANNULE. Nothing to restore.
    }
};
