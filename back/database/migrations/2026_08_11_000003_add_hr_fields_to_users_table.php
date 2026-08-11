<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Base monthly salary, kept separate from `commission_rate` /
            // `prime_per_tyre` (variable pay). Only surfaced in UserResource
            // when the requester has `view hr-charges` — see UserResource.
            $table->decimal('salary', 10, 2)->nullable()->after('prime_per_tyre');
            $table->string('cnss_number')->nullable()->after('salary');
            $table->date('hire_date')->nullable()->after('cnss_number');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['salary', 'cnss_number', 'hire_date']);
        });
    }
};
