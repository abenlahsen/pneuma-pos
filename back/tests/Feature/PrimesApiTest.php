<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\CompanySetting;
use App\Models\PrimeThreshold;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
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
 * Refonte 2b, 9b — the day-by-day series the Primes screen needs.
 *
 * Like MonthlyReportTest, every fixture lives in a month no other suite writes
 * to (February 2014), so the assertions can be exact equalities even though the
 * test database is shared.
 */
class PrimesApiTest extends TestCase
{
    use DatabaseTransactions;

    private const YEAR = 2014;

    private const MONTH = 2;

    private User $admin;

    private User $commercial;

    private Product $tyre;

    private Product $service;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::findOrCreate('view primes', 'web');
        Permission::findOrCreate('view sales', 'web');
        // The net-margin assertion cross-checks the monthly report endpoint.
        Permission::findOrCreate('view reporting', 'web');

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $sellerRole = Role::findOrCreate('Commercial', 'web');
        $sellerRole->syncPermissions(['view sales']);

        $this->admin = $this->createUser('Admin Primes', 0);
        $this->admin->assignRole($adminRole);

        $this->commercial = $this->createUser('Vendeur Primes', 25);
        $this->commercial->assignRole($sellerRole);

        $brand = Brand::firstOrCreate(['name' => 'PrimeBrand'], ['is_active' => true]);

        $this->tyre = Product::query()->create([
            'reference' => 'PRIME-TYRE-'.uniqid(),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);
        DB::table('product_tyres')->insert([
            'product_id' => $this->tyre->id,
            'tire_width' => 195,
            'tire_height' => 65,
            'tire_diameter' => 15,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // A non-tyre product, to prove the series counts tyres only.
        $this->service = Product::query()->create([
            'reference' => 'PRIME-PART-'.uniqid(),
            'type' => 'part',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);
    }

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/primes-commerciaux')->assertUnauthorized();
    }

    public function test_requires_view_primes_permission(): void
    {
        Sanctum::actingAs($this->commercial, [], 'web');

        $this->getJson('/api/primes-commerciaux')->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // The day-by-day series
    // -------------------------------------------------------------------------

    public function test_daily_series_covers_every_day_of_the_month(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $daily = $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()
            ->json('daily');

        // February 2014 is not a leap year: 28 days, none missing.
        $this->assertCount(28, $daily);
        $this->assertSame('2014-02-01', $daily[0]['date']);
        $this->assertSame('2014-02-28', $daily[27]['date']);
    }

    public function test_daily_series_splits_sales_and_service_and_sums_to_the_shop_total(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        $response = $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk();

        $daily = collect($response->json('daily'))->keyBy('date');

        // 10 February: 4 tyres sold, 2 tyres fitted in the workshop.
        $this->assertSame(4, $daily['2014-02-10']['sale_tyres']);
        $this->assertSame(2, $daily['2014-02-10']['so_tyres']);
        $this->assertSame(6, $daily['2014-02-10']['total_tyres']);

        // 20 February: 3 tyres sold, and a non-tyre part that must not count.
        $this->assertSame(3, $daily['2014-02-20']['sale_tyres']);
        $this->assertSame(0, $daily['2014-02-20']['so_tyres']);

        // A day without movement is present and empty, not absent.
        $this->assertSame(0, $daily['2014-02-15']['total_tyres']);

        // The series and the headline figure are the same measurement.
        $this->assertSame(
            (int) $response->json('shop_total_tyres'),
            $daily->sum('total_tyres'),
        );
    }

    public function test_daily_series_ignores_other_months(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        // The same fixture seen from March: nothing.
        $daily = $this->getJson('/api/primes-commerciaux?year=2014&month=3')
            ->assertOk()
            ->json('daily');

        $this->assertSame(0, collect($daily)->sum('total_tyres'));
    }

    // -------------------------------------------------------------------------
    // Net margin
    // -------------------------------------------------------------------------

    public function test_net_margin_matches_the_monthly_report(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        $primes = $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk();
        $report = $this->getJson('/api/reporting/monthly?year=2014&month=2')->assertOk();

        $this->assertSame(
            (float) $report->json('current.margin.net'),
            (float) $primes->json('net_margin'),
        );
    }

    // -------------------------------------------------------------------------
    // Threshold
    // -------------------------------------------------------------------------

    public function test_threshold_comes_from_company_settings(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $settings = CompanySetting::query()->first();
        if ($settings) {
            $settings->update(['prime_threshold' => 900]);
        } else {
            CompanySetting::query()->create(['company_name' => 'Test', 'prime_threshold' => 900]);
        }

        $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()
            ->assertJsonPath('prime_threshold', 900);
    }

    // -------------------------------------------------------------------------
    // Cancelled rows
    // -------------------------------------------------------------------------

    public function test_a_cancelled_sale_earns_no_bonus(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        $before = (int) $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()->json('shop_total_tyres');

        // La même vente, annulée : ses pneus sortent du compte.
        $cancelled = $this->createSale('2014-02-05');
        SaleItem::query()->create([
            'sale_id' => $cancelled->id,
            'product_id' => $this->tyre->id,
            'quantity' => 6,
            'purchase_price' => 200,
            'selling_price' => 400,
            'discount' => 0,
            'total_purchase' => 1200,
            'total_sale' => 2400,
            'margin' => 1200,
        ]);
        $cancelled->update(['status' => 'ANNULE']);

        $response = $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk();

        $this->assertSame($before, (int) $response->json('shop_total_tyres'));

        // La série jour par jour compte de la même façon, sinon la jauge ment.
        $daily = collect($response->json('daily'))->keyBy('date');
        $this->assertSame(0, $daily['2014-02-05']['total_tyres']);
        $this->assertSame($before, $daily->sum('total_tyres'));
    }

    public function test_a_cancelled_service_order_earns_no_bonus(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        $before = (int) $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()->json('shop_total_tyres');

        $order = ServiceOrder::query()->create([
            'date' => '2014-02-06',
            'vehicle' => 'Peugeot 208',
            'mileage' => 40000,
            'total_amount' => 1200,
            'discount' => 0,
            'net_amount' => 1200,
            'status' => 'ANNULE',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->commercial->id,
            'created_by' => $this->admin->id,
        ]);
        ServiceItem::query()->create([
            'service_order_id' => $order->id,
            'item_type' => 'part',
            'product_id' => $this->tyre->id,
            'product_name' => 'Pneu 195/65R15',
            'quantity' => 3,
            'unit_price' => 400,
            'parts_cost' => 0,
            'labor_cost' => 0,
            'line_total' => 1200,
            'sort_order' => 0,
        ]);

        $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()
            ->assertJsonPath('shop_total_tyres', $before);
    }

    public function test_the_history_leaves_cancelled_sales_out_too(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        $cancelled = $this->createSale('2014-02-18');
        SaleItem::query()->create([
            'sale_id' => $cancelled->id,
            'product_id' => $this->tyre->id,
            'quantity' => 5,
            'purchase_price' => 200,
            'selling_price' => 400,
            'discount' => 0,
            'total_purchase' => 1000,
            'total_sale' => 2000,
            'margin' => 1000,
        ]);
        $cancelled->update(['status' => 'ANNULE']);

        // Février vu depuis mars : le mois d'historique compte comme l'écran.
        $current = $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk();
        $fromMarch = $this->getJson('/api/primes-commerciaux?year=2014&month=3')->assertOk();

        $this->assertSame(9, (int) $current->json('shop_total_tyres'));
        $this->assertSame(9, (int) $fromMarch->json('history.0.shop_total_tyres'));
    }

    // -------------------------------------------------------------------------
    // History — the threshold that applied then
    // -------------------------------------------------------------------------

    public function test_history_covers_the_six_months_before_the_one_shown(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $history = $this->getJson('/api/primes-commerciaux?year=2014&month=2')
            ->assertOk()
            ->json('history');

        $this->assertCount(6, $history);
        // Février 2014 → janvier 2014 en premier, août 2013 en dernier.
        $this->assertSame([2014, 1], [$history[0]['year'], $history[0]['month']]);
        $this->assertSame([2013, 8], [$history[5]['year'], $history[5]['month']]);
    }

    public function test_history_reports_the_threshold_in_force_at_each_month_end(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        // Le seuil passe de 400 à 700 le 10 janvier 2014.
        PrimeThreshold::query()->create(['threshold' => 400, 'effective_from' => '2013-11-01']);
        PrimeThreshold::query()->create(['threshold' => 700, 'effective_from' => '2014-01-10']);

        $history = collect(
            $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk()->json('history')
        )->keyBy(fn ($month) => "{$month['year']}-{$month['month']}");

        // Janvier se termine après le changement : c'est 700 qui valait alors.
        $this->assertSame(700, $history['2014-1']['prime_threshold']);
        // Décembre et novembre se terminent avant : 400.
        $this->assertSame(400, $history['2013-12']['prime_threshold']);
        $this->assertSame(400, $history['2013-11']['prime_threshold']);
        // Octobre précède toute ligne enregistrée : le seuil est inconnu, pas nul.
        $this->assertNull($history['2013-10']['prime_threshold']);
    }

    public function test_history_counts_tyres_the_same_way_as_the_current_month(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedFebruary2014();

        // Vue depuis mars, février devient le premier mois de l'historique et
        // doit porter exactement le total que l'écran affichait en février.
        $current = $this->getJson('/api/primes-commerciaux?year=2014&month=2')->assertOk();
        $fromMarch = $this->getJson('/api/primes-commerciaux?year=2014&month=3')->assertOk();

        $this->assertSame(
            (int) $current->json('shop_total_tyres'),
            (int) $fromMarch->json('history.0.shop_total_tyres'),
        );
        $this->assertSame(9, (int) $fromMarch->json('history.0.shop_total_tyres'));
    }

    // -------------------------------------------------------------------------
    // Fixtures
    // -------------------------------------------------------------------------

    private function createUser(string $name, float $primePerTyre): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'prime_per_tyre' => $primePerTyre,
            'must_change_password' => false,
        ]);
    }

    private function seedFebruary2014(): void
    {
        $sale = $this->createSale('2014-02-10');
        SaleItem::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $this->tyre->id,
            'quantity' => 4,
            'purchase_price' => 200,
            'selling_price' => 400,
            'discount' => 0,
            'total_purchase' => 800,
            'total_sale' => 1600,
            'margin' => 800,
        ]);

        $later = $this->createSale('2014-02-20');
        SaleItem::query()->create([
            'sale_id' => $later->id,
            'product_id' => $this->tyre->id,
            'quantity' => 3,
            'purchase_price' => 200,
            'selling_price' => 400,
            'discount' => 0,
            'total_purchase' => 600,
            'total_sale' => 1200,
            'margin' => 600,
        ]);
        SaleItem::query()->create([
            'sale_id' => $later->id,
            'product_id' => $this->service->id,
            'quantity' => 5,
            'purchase_price' => 10,
            'selling_price' => 20,
            'discount' => 0,
            'total_purchase' => 50,
            'total_sale' => 100,
            'margin' => 50,
        ]);

        $order = ServiceOrder::query()->create([
            'date' => '2014-02-10',
            'vehicle' => 'Dacia Logan',
            'mileage' => 90000,
            'total_amount' => 800,
            'discount' => 0,
            'net_amount' => 800,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->commercial->id,
            'created_by' => $this->admin->id,
        ]);
        ServiceItem::query()->create([
            'service_order_id' => $order->id,
            'item_type' => 'part',
            'product_id' => $this->tyre->id,
            'product_name' => 'Pneu 195/65R15',
            'quantity' => 2,
            'unit_price' => 400,
            'parts_cost' => 0,
            'labor_cost' => 0,
            'line_total' => 800,
            'sort_order' => 0,
        ]);
    }

    private function createSale(string $date): Sale
    {
        return Sale::query()->create([
            'date' => $date,
            'with_invoice' => false,
            'total_quantity' => 1,
            'total_purchase' => 0,
            'total_sale' => 0,
            'margin' => 0,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->commercial->id,
            'created_by' => $this->admin->id,
        ]);
    }
}
