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
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('stock_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('quantity')->default(1);
            $table->decimal('purchase_price', 10, 2)->default(0);
            $table->decimal('selling_price', 10, 2)->default(0);
            $table->decimal('total_purchase', 10, 2)->default(0);
            $table->decimal('total_sale', 10, 2)->default(0);
            $table->decimal('margin', 10, 2)->default(0);
            $table->timestamps();
        });

        // Migrate existing data
        $sales = DB::table('sales')->get();
        foreach ($sales as $sale) {
            DB::table('sale_items')->insert([
                'sale_id' => $sale->id,
                'product_id' => $sale->product_id,
                'stock_id' => $sale->stock_id,
                'quantity' => $sale->quantity ?? 1,
                'purchase_price' => $sale->purchase_price ?? 0,
                'selling_price' => $sale->selling_price ?? 0,
                'total_purchase' => $sale->total_purchase ?? 0,
                'total_sale' => $sale->total_sale ?? 0,
                'margin' => $sale->margin ?? 0,
                'created_at' => $sale->created_at,
                'updated_at' => $sale->updated_at,
            ]);
        }

        // Rename quantity to total_quantity for the header
        Schema::table('sales', function (Blueprint $table) {
            $table->renameColumn('quantity', 'total_quantity');
            $table->dropForeign(['product_id']);
            $table->dropForeign(['stock_id']);
            $table->dropColumn([
                'product_id',
                'stock_id',
                'purchase_price',
                'selling_price'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->renameColumn('total_quantity', 'quantity');
            $table->foreignId('product_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('stock_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('purchase_price', 10, 2)->default(0);
            $table->decimal('selling_price', 10, 2)->default(0);
        });

        $items = DB::table('sale_items')->get();
        foreach ($items as $item) {
            DB::table('sales')->where('id', $item->sale_id)->update([
                'product_id' => $item->product_id,
                'stock_id' => $item->stock_id,
                'purchase_price' => $item->purchase_price,
                'selling_price' => $item->selling_price,
            ]);
            // Take only the first item to keep 1:1 logic
            DB::table('sale_items')->where('sale_id', $item->sale_id)->delete();
        }

        Schema::dropIfExists('sale_items');
    }
};
