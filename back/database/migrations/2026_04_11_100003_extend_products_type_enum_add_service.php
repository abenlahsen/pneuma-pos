<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE products MODIFY COLUMN type ENUM('tyre','part','service') NOT NULL");
    }

    public function down()
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        // Safety: do not allow rollback if any service products exist
        $count = (int) DB::table('products')->where('type', 'service')->count();
        if ($count > 0) {
            throw new \RuntimeException("Cannot rollback: {$count} product(s) with type='service' still exist.");
        }

        DB::statement("ALTER TABLE products MODIFY COLUMN type ENUM('tyre','part') NOT NULL");
    }
};
