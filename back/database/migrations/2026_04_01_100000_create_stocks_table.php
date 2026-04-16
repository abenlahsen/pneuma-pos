<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->string('brand')->nullable();
            $table->string('profile')->nullable();
            $table->string('dimension', 100)->nullable();
            $table->smallInteger('width')->unsigned()->nullable();
            $table->smallInteger('height')->unsigned()->nullable();
            $table->smallInteger('diameter')->unsigned()->nullable();
            $table->string('ic', 50)->nullable();
            $table->string('iv', 10)->nullable();
            $table->boolean('rft')->default(false);
            $table->boolean('reinforced')->default(false);
            $table->string('marking')->nullable();
            $table->string('made_in', 100)->nullable();
            $table->string('dot', 50)->nullable();
            $table->string('depot', 100)->nullable();
            $table->string('zone', 50)->nullable();
            $table->integer('quantity')->default(0);
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->decimal('special_price', 10, 2)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index(['width', 'height', 'diameter']);
            $table->index('brand');
            $table->index('depot');
        });
    }

    public function down()
    {
        Schema::dropIfExists('stocks');
    }
};
