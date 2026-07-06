<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_payment_id')->constrained('purchase_payments')->cascadeOnDelete();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->timestamps();

            $table->unique(['purchase_payment_id', 'purchase_id'], 'ppa_payment_purchase_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_payment_allocations');
    }
};
