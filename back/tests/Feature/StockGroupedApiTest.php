<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\ProductTyre;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Stock;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockGroupedApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::findOrCreate('view stock', 'web');

        $this->user = User::query()->create([
            'name' => 'Stock Grouped Test',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000060',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->givePermissionTo('view stock');

        $brand = Brand::query()->firstOrCreate(['name' => 'MARQUE GROUPED TEST'], ['is_active' => true]);

        $this->product = Product::query()->create([
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'profile' => 'PROFIL GROUPED TEST',
            'reference' => 'REF-GROUPED-TEST-'.fake()->unique()->numerify('####'),
            'is_active' => true,
        ]);

        ProductTyre::query()->create([
            'product_id' => $this->product->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'tire_load_index' => '91',
            'tire_speed_index' => 'V',
        ]);
    }

    public function test_grouped_requires_view_stock_permission(): void
    {
        $guest = User::query()->create([
            'name' => 'No Stock Permission',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000061',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/stocks-grouped')->assertForbidden();
    }

    public function test_several_lots_collapse_into_one_reference(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makeLot(['depot' => 'Casa', 'zone' => 'A3', 'quantity' => 4, 'purchase_price' => 1000]);
        $this->makeLot(['depot' => 'Rabat', 'zone' => 'B1', 'quantity' => 6, 'purchase_price' => 1000]);
        $this->makeLot(['depot' => 'Casa', 'zone' => 'A3', 'quantity' => 0, 'purchase_price' => 900]);

        $response = $this->getJson('/api/stocks-grouped?per_page=200');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('product_id', $this->product->id);

        $this->assertNotNull($row, 'La référence doit apparaître une seule fois.');
        $this->assertSame(10, $row['quantity']);
        $this->assertEquals(10000, $row['value']);
        $this->assertSame(3, $row['lots_count'], 'Le lot épuisé reste rattaché à sa référence.');
        $this->assertSame('205/55R16', $row['dimension']);
        $this->assertCount(3, $row['lots']);

        $depots = collect($row['by_depot'])->pluck('quantity', 'depot');
        $this->assertSame(6, $depots['Rabat']);
        $this->assertSame(4, $depots['Casa']);
    }

    public function test_low_stock_filter_keeps_references_selling_faster_than_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makeLot(['quantity' => 2, 'purchase_price' => 800]);
        $this->sell(9, Carbon::today()->subDays(10));

        $response = $this->getJson('/api/stocks-grouped?per_page=200&low_stock=1');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('product_id', $this->product->id);
        $this->assertNotNull($row, 'Il reste 2 alors que 9 sont partis en un mois.');
        $this->assertSame(9, $row['sold_30d']);
    }

    public function test_low_stock_filter_drops_a_reference_that_is_well_stocked(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makeLot(['quantity' => 40, 'purchase_price' => 800]);
        $this->sell(3, Carbon::today()->subDays(5));

        $response = $this->getJson('/api/stocks-grouped?per_page=200&low_stock=1');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('product_id');
        $this->assertNotContains($this->product->id, $ids);
    }

    public function test_dormant_filter_keeps_stock_without_sale_for_six_months(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makeLot(['quantity' => 12, 'purchase_price' => 500]);
        $this->sell(4, Carbon::today()->subDays(300));

        $response = $this->getJson('/api/stocks-grouped?per_page=200&dormant=1');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('product_id', $this->product->id);
        $this->assertNotNull($row);
        $this->assertSame(0, $row['sold_180d']);
    }

    public function test_summary_exposes_the_new_markers(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makeLot(['quantity' => 5, 'purchase_price' => 600]);

        $response = $this->getJson('/api/stocks-summary');

        $response->assertOk()->assertJsonStructure([
            'total_articles', 'total_quantity', 'total_purchase_value',
            'references_count', 'depots_count', 'low_stock_count', 'zero_count',
            'dormant_days', 'dormant_count', 'dormant_value', 'coverage_days',
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeLot(array $attributes = []): Stock
    {
        return Stock::query()->create(array_merge([
            'product_id' => $this->product->id,
            'depot' => 'Casa',
            'zone' => 'A1',
            'quantity' => 1,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ], $attributes));
    }

    private function sell(int $quantity, Carbon $date): void
    {
        $sale = Sale::query()->create([
            'date' => $date->toDateString(),
            'total_quantity' => $quantity,
            'total_purchase' => 0,
            'total_sale' => 100 * $quantity,
            'margin' => 0,
            'status' => 'LIVRE',
            'payment_status' => 'PAYE',
            'created_by' => $this->user->id,
        ]);

        SaleItem::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $this->product->id,
            'quantity' => $quantity,
            'selling_price' => 100,
            'purchase_price' => 0,
        ]);
    }
}
