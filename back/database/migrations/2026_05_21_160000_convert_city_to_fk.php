<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function normalize(string $value): string
    {
        $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        return strtolower(trim((string) $s));
    }

    public function up(): void
    {
        // Build normalized lookup: "casablanca" => 1, "fes" => 2, ...
        $lookup = [];
        foreach (DB::table('cities')->get() as $city) {
            $lookup[$this->normalize($city->name)] = $city->id;
        }

        foreach (['clients', 'partners', 'company_settings'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->unsignedBigInteger('city_id')->nullable()->after('city');
                $table->foreign('city_id')->references('id')->on('cities')->nullOnDelete();
            });

            // Migrate existing text values to city_id
            foreach (
                DB::table($table)
                    ->whereNotNull('city')
                    ->where('city', '!=', '')
                    ->distinct()
                    ->pluck('city') as $cityText
            ) {
                $key = $this->normalize($cityText);
                if (isset($lookup[$key])) {
                    DB::table($table)
                        ->where('city', $cityText)
                        ->update(['city_id' => $lookup[$key]]);
                }
            }

            Schema::table($table, function (Blueprint $table) {
                $table->dropColumn('city');
            });
        }
    }

    public function down(): void
    {
        foreach (['clients', 'partners', 'company_settings'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->string('city')->nullable()->after('city_id');
            });

            // Restore text values from FK
            DB::table($table)
                ->whereNotNull('city_id')
                ->get()
                ->each(function ($row) use ($table) {
                    $city = DB::table('cities')->where('id', $row->city_id)->value('name');
                    if ($city) {
                        DB::table($table)->where('id', $row->id)->update(['city' => $city]);
                    }
                });

            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['city_id']);
                $table->dropColumn('city_id');
            });
        }
    }
};
