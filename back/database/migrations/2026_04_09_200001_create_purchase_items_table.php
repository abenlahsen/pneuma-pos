<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('stock_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->timestamps();
        });

        // Migrate existing data
        $purchases = DB::table('purchases')->get();
        foreach ($purchases as $purchase) {
            DB::table('purchase_items')->insert([
                'purchase_id' => $purchase->id,
                'product_id' => $purchase->product_id,
                'stock_id' => $purchase->stock_id,
                'quantity' => $purchase->quantity ?? 1,
                'unit_price' => $purchase->unit_price ?? 0,
                'created_at' => $purchase->created_at,
                'updated_at' => $purchase->updated_at,
            ]);
        }

        // Add total_price to purchases and rename quantity to total_quantity
        Schema::table('purchases', function (Blueprint $table) {
            $table->renameColumn('quantity', 'total_quantity');
            $table->decimal('total_price', 10, 2)->default(0);
        });

        // Compute total_price for existing ones
        $purchases = DB::table('purchases')->get();
        foreach ($purchases as $p) {
            $totalPrice = ($p->unit_price ?? 0) * ($p->total_quantity ?? 1); // After rename, it should have been fetched BEFORE but we are updating AFTER so just use logic. Wait, we've already fetched above. Let's do a direct DB update.
            DB::table('purchases')->where('id', $p->id)->update(['total_price' => $totalPrice]);
        }

        // Drop old columns from purchases table
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['stock_id']);
            $table->dropColumn([
                'product', // text field
                'product_id',
                'stock_id',
                'unit_price'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->renameColumn('total_quantity', 'quantity');
            $table->dropColumn('total_price');
            $table->string('product')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('stock_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('unit_price', 10, 2)->default(0);
        });

        $items = DB::table('purchase_items')->get();
        foreach ($items as $item) {
            DB::table('purchases')->where('id', $item->purchase_id)->update([
                'product_id' => $item->product_id,
                'stock_id' => $item->stock_id,
                'unit_price' => $item->unit_price,
            ]);
            DB::table('purchase_items')->where('purchase_id', $item->purchase_id)->delete();
        }

        Schema::dropIfExists('purchase_items');
    }
};
