<?php

namespace Database\Seeders;

use App\Domain\Sales\PrestationCatalog;
use App\Models\Partner;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the catalog products backing the tyre-sale prestations (Montage +
 * Équilibrage, Parallélisme Tourisme / SUV-4x4) and, for partners that don't
 * have their own rate yet, a sensible default price. Idempotent — safe to
 * run on every deploy.
 */
class PrestationsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PrestationCatalog::entries() as $entry) {
            $product = Product::firstOrCreate(
                ['reference' => $entry['reference']],
                [
                    'type' => 'service',
                    'is_active' => true,
                    'profile' => $entry['label'],
                ]
            );

            DB::table('product_services')->insertOrIgnore([
                'product_id' => $product->id,
                'category' => 'tires',
                'selling_price' => $entry['default_price'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Partner::whereNull('montage_price')->update(['montage_price' => 30]);
        Partner::whereNull('alignment_price')->update(['alignment_price' => 100]);
        Partner::whereNull('alignment_price_suv')->update(['alignment_price_suv' => 150]);
    }
}
