<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipment_change_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_change_request_id')->constrained('shipment_change_requests')->cascadeOnDelete();
            $table->string('field');
            $table->string('custom_label')->nullable();
            $table->string('old_value')->nullable();
            $table->string('new_value');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_change_request_items');
    }
};
