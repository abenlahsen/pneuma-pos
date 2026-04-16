<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['brand', 'dimension', 'profile', 'ic', 'iv', 'rft']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('brand')->nullable();
            $table->string('dimension')->nullable();
            $table->string('profile')->nullable();
            $table->string('ic')->nullable();
            $table->string('iv')->nullable();
            $table->string('rft')->nullable();
        });
    }
};
