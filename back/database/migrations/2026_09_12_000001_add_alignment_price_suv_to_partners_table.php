<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->decimal('alignment_price_suv', 8, 2)->nullable()->after('alignment_price')
                ->comment('Parallélisme SUV/4x4 price');
        });
    }

    public function down()
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->dropColumn('alignment_price_suv');
        });
    }
};
