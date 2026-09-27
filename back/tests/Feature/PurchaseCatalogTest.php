<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Refonte 2b, 12b — la recherche de la saisie d'achat (GET /api/purchase-catalog).
 */
class PurchaseCatalogTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Supplier $michelin;

    private Supplier $other;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Permission::findOrCreate('view purchases', 'web');
        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->givePermissionTo('view purchases');

        $this->user = User::query()->create([
            'name' => 'Acheteur',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);

        $this->michelin = Supplier::query()->create(['name' => 'Michelin Maroc '.fake()->unique()->numerify('###'), 'user_id' => $this->user->id]);
        $this->other = Supplier::query()->create(['name' => 'Pneus Import '.fake()->unique()->numerify('###'), 'user_id' => $this->user->id]);
    }

    /** Un pneu 205/55R16 91V et un lot. */
    private function tyre(string $profile, int $width = 205, int $height = 55, int $diameter = 16): array
    {
        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);
        $product = Product::query()->create([
            'profile' => $profile,
            'reference' => 'REF-'.fake()->unique()->numerify('#####'),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);
        DB::table('product_tyres')->insert([
            'product_id' => $product->id,
            'tire_width' => $width,
            'tire_height' => $height,
            'tire_diameter' => $diameter,
            'tire_load_index' => '91',
            'tire_speed_index' => 'V',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $stock = Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => 4,
            'purchase_price' => 800,
            'depot' => 'Casablanca',
            'zone' => 'A-12',
            'user_id' => $this->user->id,
        ]);

        return [$product, $stock];
    }

    private function buy(Supplier $supplier, Product $product, Stock $stock, float $price, string $date, string $status = 'RECU'): Purchase
    {
        $purchase = Purchase::query()->create([
            'date' => $date,
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => $price,
            'discount' => 0,
            'net_amount' => $price,
            'status' => $status,
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
        PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 1,
            'unit_price' => $price,
        ]);

        return $purchase;
    }

    public function test_it_requires_the_view_purchases_permission(): void
    {
        $this->getJson('/api/purchase-catalog?q=2055516')->assertUnauthorized();
    }

    public function test_the_shorthand_dimension_finds_the_tyre_with_its_lots(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        [$primacy] = $this->tyre('Primacy 4');
        $this->tyre('Pilot Sport', 225, 45, 17);

        $rows = collect($this->getJson('/api/purchase-catalog?q=2055516')->assertOk()->json('data'));

        $row = $rows->firstWhere('id', $primacy->id);
        $this->assertNotNull($row);
        $this->assertSame('205/55R16 91V', $row['dimension']);
        $this->assertSame(4, $row['stock_total']);
        $this->assertSame('Casablanca', $row['lots'][0]['depot']);
        $this->assertFalse($rows->contains(fn ($r) => $r['dimension'] === '225/45R17 91V'));
    }

    public function test_it_gives_the_last_price_overall_and_at_the_chosen_supplier(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        [$primacy, $stock] = $this->tyre('Primacy 4');
        $this->buy($this->michelin, $primacy, $stock, 812, '2026-05-14');
        $this->buy($this->other, $primacy, $stock, 790, '2026-06-02');
        $this->buy($this->michelin, $primacy, $stock, 700, '2026-07-01', 'ANNULE');

        $row = collect($this->getJson("/api/purchase-catalog?q=2055516&supplier_id={$this->michelin->id}")->json('data'))
            ->firstWhere('id', $primacy->id);

        // Le dernier achat, tous fournisseurs : l'achat annulé ne compte pas.
        $this->assertEquals(790, $row['last_purchase']['unit_price']);
        $this->assertSame($this->other->name, $row['last_purchase']['supplier_name']);
        // Chez le fournisseur choisi.
        $this->assertEquals(812, $row['supplier_last_purchase']['unit_price']);
        $this->assertSame('2026-05-14', $row['supplier_last_purchase']['date']);
        $this->assertTrue($row['bought_from_supplier']);
    }

    public function test_products_already_bought_from_the_supplier_come_first(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        [$alpha] = $this->tyre('Alpha');
        [$zeta, $zetaStock] = $this->tyre('Zeta');
        $this->buy($this->michelin, $zeta, $zetaStock, 800, '2026-05-14');

        $ids = collect($this->getJson("/api/purchase-catalog?q=2055516&supplier_id={$this->michelin->id}")->json('data'))
            ->pluck('id')->values();

        $this->assertLessThan($ids->search($alpha->id), $ids->search($zeta->id));
    }

    public function test_the_purchase_being_edited_is_not_its_own_last_price(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        [$primacy, $stock] = $this->tyre('Primacy 4');
        $this->buy($this->michelin, $primacy, $stock, 812, '2026-05-14');
        $editing = $this->buy($this->michelin, $primacy, $stock, 830, '2026-09-17');

        $row = collect($this->getJson("/api/purchase-catalog?ids[]={$primacy->id}&exclude_purchase_id={$editing->id}")->json('data'))
            ->firstWhere('id', $primacy->id);

        $this->assertEquals(812, $row['last_purchase']['unit_price']);
    }

    public function test_it_returns_the_last_selling_price_as_the_only_price_reference(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        [$primacy, $stock] = $this->tyre('Primacy 4');
        $client = \App\Models\Client::query()->create(['name' => 'C', 'created_by' => $this->user->id, 'updated_by' => $this->user->id, 'is_active' => true]);
        $sale = \App\Models\Sale::query()->create(['date' => '2026-09-01', 'client_id' => $client->id, 'status' => 'LIVRE', 'payment_status' => 'PAYE', 'total_quantity' => 1, 'total_sale' => 1180, 'total_purchase' => 800, 'margin' => 380]);
        $sale->items()->create(['product_id' => $primacy->id, 'stock_id' => $stock->id, 'quantity' => 1, 'purchase_price' => 800, 'selling_price' => 1180]);

        $row = collect($this->getJson('/api/purchase-catalog?q=2055516')->json('data'))->firstWhere('id', $primacy->id);

        $this->assertEquals(1180, $row['last_sale_price']);
    }
}
