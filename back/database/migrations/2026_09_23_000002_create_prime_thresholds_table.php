<?php

use App\Models\CompanySetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2b, 9b — the history of the collective bonus threshold.
 *
 * `company_settings.prime_threshold` is a single scalar: change it and the
 * previous value is gone. The Primes screen needs the threshold that applied
 * in a past month, so each change is appended here instead.
 *
 * This recovers nothing from the past — it starts counting now. The seed row
 * below carries today's value dated to the first of the current month, which
 * is the earliest date for which the value is known to be true. Every month
 * before that is reported without a threshold, and the screen shows a dash
 * rather than a verdict it cannot support.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prime_thresholds', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('threshold');
            $table->date('effective_from');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('effective_from');
        });

        $current = (int) (CompanySetting::query()->value('prime_threshold') ?? 0);

        if ($current > 0) {
            DB::table('prime_thresholds')->insert([
                'threshold' => $current,
                'effective_from' => now()->startOfMonth()->toDateString(),
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('prime_thresholds');
    }
};
