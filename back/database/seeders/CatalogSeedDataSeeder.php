<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Stock;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CatalogSeedDataSeeder extends Seeder
{
    public function run(): void
    {
        $brands = [
            'MICHELIN'    => $this->tyreSpecs('MICHELIN'),
            'GOODYEAR'    => $this->tyreSpecs('GOODYEAR'),
            'CONTINENTAL' => $this->tyreSpecs('CONTINENTAL'),
            'BRIDGESTONE' => $this->tyreSpecs('BRIDGESTONE'),
            'PIRELLI'     => $this->tyreSpecs('PIRELLI'),
            'DUNLOP'      => $this->tyreSpecs('DUNLOP'),
        ];

        $user = \App\Models\User::first();

        foreach ($brands as $brandName => $specs) {
            $brand = Brand::firstOrCreate(['name' => $brandName], ['is_active' => true]);

            foreach ($specs as $s) {
                [$w, $h, $d] = $s;
                $ref = "{$brandName}-{$w}/{$h}R{$d}";

                $product = Product::firstOrCreate(
                    ['reference' => $ref],
                    [
                        'type'     => 'tyre',
                        'brand_id' => $brand->id,
                        'is_active' => true,
                        'profile'  => 'E2E',
                    ]
                );

                DB::table('product_tyres')->insertOrIgnore([
                    'product_id'    => $product->id,
                    'tire_width'    => $w,
                    'tire_height'   => $h,
                    'tire_diameter' => $d,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);

                Stock::firstOrCreate(
                    ['product_id' => $product->id],
                    [
                        'quantity'       => rand(2, 20),
                        'purchase_price' => rand(300, 800),
                        'depot'          => 'D1',
                        'made_in'        => 'France',
                        'user_id'        => $user?->id,
                    ]
                );
            }
        }
    }

    private function tyreSpecs(string $brand): array
    {
        // Common dimensions shared by all brands
        $common = [
            [205, 55, 16], [195, 65, 15], [225, 45, 17], [215, 60, 16],
            [185, 65, 15], [205, 60, 16], [235, 45, 18], [175, 70, 13],
        ];

        // MICHELIN and GOODYEAR get extra dimensions to reach >10 products for filter tests
        if (in_array($brand, ['MICHELIN', 'GOODYEAR', 'CONTINENTAL'])) {
            return array_merge($common, [[205, 55, 17], [245, 45, 18], [225, 50, 17], [215, 55, 16]]);
        }

        return $common;
    }
}
