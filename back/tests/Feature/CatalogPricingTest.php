<?php

namespace Tests\Feature;

use App\Domain\Pricing\CatalogPriceInitializer;
use App\Domain\Pricing\ClientPriceResolver;
use App\Models\Brand;
use App\Models\Client;
use App\Models\Product;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Le prix catalogue et la remise client (étape 13, décision prix).
 */
class CatalogPricingTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['view products', 'create products', 'edit products', 'view stock', 'view clients', 'create clients', 'edit clients'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }
        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::query()->get());

        $this->user = User::query()->create([
            'name' => 'Admin Prix',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);
        Sanctum::actingAs($this->user, [], 'web');

        // Tous les produits existants reçoivent un prix : seuls ceux du test restent à initialiser.
        DB::table('products')->update(['catalog_price' => 1]);
    }

    // ── L'initialisation ───────────────────────────────────────────────────

    public function test_median_of_the_last_90_days_is_the_catalog_price(): void
    {
        $product = $this->product();
        $today = Carbon::parse('2026-09-28');
        // 100, 120 et 200 par pneu ; la dernière ligne a une remise de ligne : 2 × 110 − 20 = 200 → 100.
        $this->saleLine($product, '2026-09-20', 1, 100);
        $this->saleLine($product, '2026-08-15', 2, 240);
        $this->saleLine($product, '2026-07-10', 1, 200);
        $this->saleLine($product, '2026-09-01', 2, 200);
        // Hors fenêtre et annulée : ignorées.
        $this->saleLine($product, '2026-05-01', 1, 900);
        $this->saleLine($product, '2026-09-25', 1, 900, 'ANNULE');

        $plan = app(CatalogPriceInitializer::class)->plan(1.25, $today);

        // 100, 100, 120, 200 → médiane 110.
        $this->assertSame(['price' => 110.0, 'method' => 'median'], $plan[$product->id]);
    }

    public function test_without_recent_sales_the_last_lot_purchase_price_times_the_coefficient(): void
    {
        $product = $this->product();
        $this->lot($product, 80);
        $this->lot($product, 90); // le plus récent
        $this->lot($product, 0);  // prix nul : ignoré

        $plan = app(CatalogPriceInitializer::class)->plan(1.25, Carbon::parse('2026-09-28'));
        $this->assertSame(['price' => 112.5, 'method' => 'purchase'], $plan[$product->id]);

        $plan = app(CatalogPriceInitializer::class)->plan(1.4, Carbon::parse('2026-09-28'));
        $this->assertSame(126.0, $plan[$product->id]['price']);
    }

    public function test_without_sales_nor_purchase_price_the_product_stays_without_price(): void
    {
        $product = $this->product();
        $this->lot($product, 0);

        $plan = app(CatalogPriceInitializer::class)->plan(1.25, Carbon::parse('2026-09-28'));
        $this->assertSame(['price' => null, 'method' => null], $plan[$product->id]);
    }

    public function test_the_command_runs_once_then_only_fills_missing_prices_with_force(): void
    {
        DB::table('products')->update(['catalog_price' => null]);
        $priced = $this->product();
        $this->lot($priced, 100);
        $unpriced = $this->product();

        $this->artisan('pricing:init-catalog')->assertSuccessful();
        $this->assertSame(125.0, $priced->fresh()->catalog_price);
        $this->assertNull($unpriced->fresh()->catalog_price);

        // Une seconde fois : refusée.
        $this->artisan('pricing:init-catalog')->assertFailed();

        // --force ne remplace pas un prix saisi entre-temps.
        $priced->update(['catalog_price' => 999]);
        $this->lot($unpriced, 40);
        $this->artisan('pricing:init-catalog --force')->assertSuccessful();
        $this->assertSame(999.0, $priced->fresh()->catalog_price);
        $this->assertSame(50.0, $unpriced->fresh()->catalog_price);
    }

    public function test_dry_run_writes_nothing(): void
    {
        DB::table('products')->update(['catalog_price' => null]);
        $product = $this->product();
        $this->lot($product, 100);

        $this->artisan('pricing:init-catalog --dry-run')->assertSuccessful();
        $this->assertNull($product->fresh()->catalog_price);
    }

    // ── Le prix du client ──────────────────────────────────────────────────

    public function test_client_price_is_the_catalog_price_minus_the_client_discount(): void
    {
        $product = $this->product(1200);
        $resolver = app(ClientPriceResolver::class);

        $this->assertSame(1104.0, $resolver->priceFor($this->client(8), $product));
        $this->assertSame(1200.0, $resolver->priceFor($this->client(0), $product));
        $this->assertNull($resolver->priceFor($this->client(8), $this->product(null)));
    }

    // ── Les API ────────────────────────────────────────────────────────────

    public function test_product_catalog_price_is_saved_and_never_erased_by_a_form_that_omits_it(): void
    {
        $product = $this->product(500);

        $this->putJson("/api/products/{$product->id}", ['type' => 'tyre', 'catalog_price' => 640])
            ->assertOk()->assertJsonPath('catalog_price', 640);
        $this->assertSame(640.0, $product->fresh()->catalog_price);

        // Le formulaire actuel ne l'envoie pas encore : il reste.
        $this->putJson("/api/products/{$product->id}", ['type' => 'tyre'])->assertOk();
        $this->assertSame(640.0, $product->fresh()->catalog_price);

        $this->putJson("/api/products/{$product->id}", ['type' => 'tyre', 'catalog_price' => -1])
            ->assertStatus(422)->assertJsonValidationErrors('catalog_price');
    }

    public function test_client_discount_rate_is_saved_and_bounded(): void
    {
        $client = $this->client(0);

        $this->putJson("/api/clients/{$client->id}", ['discount_rate' => 8])
            ->assertOk()->assertJsonPath('data.discount_rate', 8);
        $this->assertSame(8.0, $client->fresh()->discount_rate);

        $this->putJson("/api/clients/{$client->id}", ['discount_rate' => 101])
            ->assertStatus(422)->assertJsonValidationErrors('discount_rate');
    }

    public function test_stock_can_list_only_references_without_catalog_price(): void
    {
        $with = $this->product(300);
        $without = $this->product(null);
        $this->lot($with, 100, 4);
        $this->lot($without, 100, 4);

        $ids = collect($this->getJson('/api/stocks?without_catalog_price=1&per_page=500')->assertOk()->json('data'))
            ->pluck('product_id');

        $this->assertTrue($ids->contains($without->id));
        $this->assertFalse($ids->contains($with->id));
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    private function product(?float $catalogPrice = null): Product
    {
        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);

        return Product::query()->create([
            'reference' => 'REF-PRIX-'.fake()->unique()->numerify('#####'),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
            'catalog_price' => $catalogPrice,
        ]);
    }

    private function lot(Product $product, float $purchasePrice, int $quantity = 0): Stock
    {
        return Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'purchase_price' => $purchasePrice,
            'user_id' => $this->user->id,
        ]);
    }

    private function saleLine(Product $product, string $date, int $quantity, float $lineTotal, string $status = 'LIVRE'): void
    {
        $saleId = DB::table('sales')->insertGetId([
            'date' => $date,
            'status' => $status,
            'total_sale' => $lineTotal,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('sale_items')->insert([
            'sale_id' => $saleId,
            'product_id' => $product->id,
            'quantity' => $quantity,
            'purchase_price' => 50,
            'selling_price' => $lineTotal / $quantity,
            'discount' => 0,
            'total_purchase' => 50 * $quantity,
            'total_sale' => $lineTotal,
            'margin' => $lineTotal - 50 * $quantity,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function client(float $discountRate): Client
    {
        return Client::query()->create([
            'name' => 'Client Prix '.fake()->unique()->numerify('####'),
            'category' => 'Particulier',
            'discount_rate' => $discountRate,
        ]);
    }
}
