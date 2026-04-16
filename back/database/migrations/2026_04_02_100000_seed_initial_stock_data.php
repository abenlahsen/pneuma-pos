<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        $jsonPath = database_path('data/stock_seed.json');

        if (! file_exists($jsonPath)) {
            return;
        }

        // Skip if stock table already has data
        if (DB::table('stocks')->count() > 0) {
            return;
        }

        $stocks = json_decode(file_get_contents($jsonPath), true);
        $now = now();

        foreach (array_chunk($stocks, 100) as $chunk) {
            $records = array_map(function ($stock) use ($now) {
                $stock['created_at'] = $now;
                $stock['updated_at'] = $now;
                return $stock;
            }, $chunk);

            DB::table('stocks')->insert($records);
        }
    }

    public function down()
    {
        // Only delete stock that has no user_id (seeded data)
        DB::table('stocks')->whereNull('user_id')->delete();
    }
};
