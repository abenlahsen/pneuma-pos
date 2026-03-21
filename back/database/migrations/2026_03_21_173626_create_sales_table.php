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
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->boolean('with_invoice')->default(false);
            $table->integer('quantity')->nullable();
            $table->string('dimension')->nullable();
            $table->string('ic')->nullable();
            $table->string('iv')->nullable();
            $table->string('rft')->nullable();
            $table->string('brand')->nullable();
            $table->string('profile')->nullable();
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->decimal('total_purchase', 12, 2)->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->decimal('total_sale', 12, 2)->nullable();
            $table->decimal('margin', 8, 2)->nullable();
            $table->string('supplier')->nullable();
            $table->string('city')->nullable();
            $table->string('transport')->nullable();
            $table->string('partner')->nullable();
            $table->string('service')->nullable();
            $table->decimal('service_fee', 10, 2)->nullable();
            $table->string('client')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('sales_rep')->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->date('delivery_date')->nullable();
            $table->text('comments')->nullable();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
