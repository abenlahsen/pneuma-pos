<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->text('reason')->nullable();
            $table->integer('total_quantity');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->foreignId('refund_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('purchase_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_returns');
    }
};
