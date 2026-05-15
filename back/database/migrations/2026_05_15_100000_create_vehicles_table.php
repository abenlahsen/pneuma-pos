<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('plate', 20);
            $table->string('brand', 100);
            $table->string('model_name', 100);
            $table->unsignedTinyInteger('circulation_month');
            $table->unsignedSmallInteger('circulation_year');
            $table->string('vin', 17)->nullable()->unique();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('client_id');
            $table->index('plate');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
