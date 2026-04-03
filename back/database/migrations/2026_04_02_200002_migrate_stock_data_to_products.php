<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Auto-create Brand records from distinct stock brand strings
        $brands = DB::table('stocks')
            ->select('brand')
            ->whereNotNull('brand')
            ->where('brand', '!=', '')
            ->distinct()
            ->pluck('brand');

        $now = now();
        foreach ($brands as $brandName) {
            DB::table('brands')->insertOrIgnore([
                'name' => $brandName,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Build brand name → id lookup
        $brandMap = DB::table('brands')->pluck('id', 'name');

        // 2. Auto-create Product records from stocks, grouped by unique product attributes
        $stocks = DB::table('stocks')->get();
        $productIdMap = []; // stock.id → product.id
        $refToProductId = []; // reference → product.id (dedup lookup)

        foreach ($stocks as $stock) {
            $brandId = $stock->brand ? ($brandMap[$stock->brand] ?? null) : null;

            // Generate reference for dedup key
            $ref = '';
            if ($stock->brand) $ref .= strtoupper(mb_substr($stock->brand, 0, 1));
            if ($stock->width) $ref .= $stock->width;
            if ($stock->height) $ref .= $stock->height;
            if ($stock->diameter) $ref .= $stock->diameter;
            if ($stock->ic) $ref .= strtoupper($stock->ic);
            if ($stock->iv) $ref .= strtoupper($stock->iv);
            if ($stock->rft) $ref .= 'RF';
            if ($stock->profile) {
                $initials = implode('', array_map(fn($w) => strtoupper(mb_substr($w, 0, 1)), preg_split('/\s+/', trim($stock->profile))));
                if ($initials) $ref .= '-' . $initials;
            }

            // Reuse existing product if same reference already created
            if ($ref && isset($refToProductId[$ref])) {
                $productIdMap[$stock->id] = $refToProductId[$ref];
                continue;
            }

            $productId = DB::table('products')->insertGetId([
                'profile' => $stock->profile,
                'reference' => $ref ?: null,
                'type' => 'tyre',
                'brand_id' => $brandId,
                'selling_price' => $stock->selling_price,
                'special_selling_price' => $stock->special_price,
                'is_active' => true,
                'tire_width' => $stock->width,
                'tire_height' => $stock->height,
                'tire_diameter' => $stock->diameter,
                'tire_load_index' => $stock->ic,
                'tire_speed_index' => $stock->iv,
                'tire_runflat' => $stock->rft,
                'tire_reinforced' => $stock->reinforced,
                'tire_marking' => $stock->marking,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($ref) {
                $refToProductId[$ref] = $productId;
            }
            $productIdMap[$stock->id] = $productId;
        }

        // 3. Add product_id column to stocks
        Schema::table('stocks', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        // 4. Link stock rows to their product
        foreach ($productIdMap as $stockId => $productId) {
            DB::table('stocks')->where('id', $stockId)->update(['product_id' => $productId]);
        }

        // 5. Drop redundant columns from stocks
        Schema::table('stocks', function (Blueprint $table) {
            $table->dropIndex(['brand']);
            $table->dropIndex(['width', 'height', 'diameter']);
        });

        Schema::table('stocks', function (Blueprint $table) {
            $table->dropColumn([
                'brand', 'profile', 'dimension',
                'width', 'height', 'diameter',
                'ic', 'iv', 'rft', 'reinforced', 'marking',
                'selling_price', 'special_price',
            ]);
        });
    }

    public function down(): void
    {
        // Re-add dropped columns to stocks
        Schema::table('stocks', function (Blueprint $table) {
            $table->string('brand')->nullable()->after('id');
            $table->string('profile')->nullable()->after('brand');
            $table->string('dimension', 100)->nullable()->after('profile');
            $table->smallInteger('width')->unsigned()->nullable()->after('dimension');
            $table->smallInteger('height')->unsigned()->nullable()->after('width');
            $table->smallInteger('diameter')->unsigned()->nullable()->after('height');
            $table->string('ic', 50)->nullable()->after('diameter');
            $table->string('iv', 10)->nullable()->after('ic');
            $table->boolean('rft')->default(false)->after('iv');
            $table->boolean('reinforced')->default(false)->after('rft');
            $table->string('marking')->nullable()->after('reinforced');
            $table->decimal('selling_price', 10, 2)->nullable()->after('purchase_price');
            $table->decimal('special_price', 10, 2)->nullable()->after('selling_price');
        });

        // Restore data from linked products
        $stocks = DB::table('stocks')->whereNotNull('product_id')->get();
        foreach ($stocks as $stock) {
            $product = DB::table('products')->find($stock->product_id);
            if (!$product) continue;

            $brand = $product->brand_id ? DB::table('brands')->find($product->brand_id) : null;

            $dimension = '';
            if ($product->tire_width) {
                $dimension = $product->tire_width;
                if ($product->tire_height) $dimension .= '/' . $product->tire_height;
                if ($product->tire_diameter) $dimension .= 'R' . $product->tire_diameter;
            }

            DB::table('stocks')->where('id', $stock->id)->update([
                'brand' => $brand?->name,
                'profile' => $product->profile,
                'dimension' => $dimension ?: null,
                'width' => $product->tire_width,
                'height' => $product->tire_height,
                'diameter' => $product->tire_diameter,
                'ic' => $product->tire_load_index,
                'iv' => $product->tire_speed_index,
                'rft' => $product->tire_runflat,
                'reinforced' => $product->tire_reinforced,
                'marking' => $product->tire_marking,
                'selling_price' => $product->selling_price,
                'special_price' => $product->special_selling_price,
            ]);
        }

        // Re-add indexes
        Schema::table('stocks', function (Blueprint $table) {
            $table->index(['width', 'height', 'diameter']);
            $table->index('brand');
        });

        // Drop product_id
        Schema::table('stocks', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });

        // Delete auto-created products (type=tyre created by this migration)
        // Note: not deleting brands as they may have been used elsewhere
    }
};
