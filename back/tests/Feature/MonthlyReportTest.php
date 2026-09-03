<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Brand;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePaymentAllocation;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use App\Models\Supplier;
use App\Models\Transaction;
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
 * The test database is shared with other suites (DatabaseTransactions, not
 * RefreshDatabase), so every fixture here lives in March 2015 — a month no
 * other test writes to — which lets the assertions be exact equalities.
 */
class MonthlyReportTest extends TestCase
{
    use DatabaseTransactions;

    private const YEAR = 2015;

    private const MONTH = 3;

    private User $admin;

    private User $manager;

    private Product $tyre;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::findOrCreate('view reporting', 'web');
        Permission::findOrCreate('view sales', 'web');

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $managerRole = Role::findOrCreate('Manager', 'web');
        $managerRole->syncPermissions(['view sales']);

        $this->admin = $this->createUser('Admin Reporting');
        $this->admin->assignRole($adminRole);

        $this->manager = $this->createUser('Manager Reporting');
        $this->manager->assignRole($managerRole);

        $brand = Brand::firstOrCreate(['name' => 'ReportBrand'], ['is_active' => true]);
        $this->tyre = Product::query()->create([
            'reference' => 'REPORT-TYRE-'.uniqid(),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);
        DB::table('product_tyres')->insert([
            'product_id' => $this->tyre->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // -------------------------------------------------------------------------
    // Auth / validation
    // -------------------------------------------------------------------------

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/reporting/monthly')->assertUnauthorized();
    }

    public function test_requires_view_reporting_permission(): void
    {
        Sanctum::actingAs($this->manager, [], 'web');

        $this->getJson('/api/reporting/monthly')->assertForbidden();
    }

    public function test_rejects_invalid_month_or_year(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->getJson('/api/reporting/monthly?year=2015&month=13')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['month']);

        $this->getJson('/api/reporting/monthly?year=abc&month=3')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['year']);
    }

    public function test_defaults_to_current_month(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->getJson('/api/reporting/monthly')
            ->assertOk()
            ->assertJsonPath('period.year', now()->year)
            ->assertJsonPath('period.month', now()->month);
    }

    // -------------------------------------------------------------------------
    // Figures
    // -------------------------------------------------------------------------

    public function test_returns_exact_monthly_figures(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedMarch2015();

        $response = $this->getJson('/api/reporting/monthly?year=2015&month=3')->assertOk();

        $response
            ->assertJsonPath('period.start', '2015-03-01')
            ->assertJsonPath('period.end', '2015-03-31')
            ->assertJsonPath('previous_period.year', 2015)
            ->assertJsonPath('previous_period.month', 2);

        $cur = $response->json('current');

        // Sales: 800 (with invoice, 2 tyres, PARTIEL) + 500 (without) — cancelled 999 excluded
        $this->assertSame(1300.0, (float) $cur['sales']['total']);
        $this->assertSame(800.0, (float) $cur['sales']['with_invoice']);
        $this->assertSame(500.0, (float) $cur['sales']['without_invoice']);
        $this->assertSame(2, $cur['sales']['count']);
        $this->assertSame(2, $cur['sales']['tyres_qty']);
        $this->assertSame(400.0, (float) $cur['sales']['avg_price_per_tyre']);
        $this->assertSame(650.0, (float) $cur['sales']['avg_basket']);
        $this->assertSame(600.0, (float) $cur['sales']['gross_margin']);
        $this->assertSame(500.0, (float) $cur['sales']['unpaid_generated']);

        // Collections: one 300 DH payment allocated to the invoiced sale
        $this->assertSame(300.0, (float) $cur['collections']['total']);
        $this->assertSame(300.0, (float) $cur['collections']['with_invoice']);
        $this->assertSame(0.0, (float) $cur['collections']['without_invoice']);
        $this->assertSame(0.0, (float) $cur['collections']['unallocated']);
        $this->assertSame(300.0, (float) $cur['collections']['by_method']['Espèces']);

        // Purchases: 1000 − 10 % = 900 (with invoice, 4 tyres) + 400 (without)
        $this->assertSame(1300.0, (float) $cur['purchases']['total']);
        $this->assertSame(900.0, (float) $cur['purchases']['with_invoice']);
        $this->assertSame(400.0, (float) $cur['purchases']['without_invoice']);
        $this->assertSame(2, $cur['purchases']['count']);
        $this->assertSame(4, $cur['purchases']['tyres_qty']);
        $this->assertSame(1300.0, (float) $cur['purchases']['unpaid_generated']);

        // Service Auto: one 200 DH labour-only order
        $this->assertSame(200.0, (float) $cur['service_orders']['revenue']);
        $this->assertSame(1, $cur['service_orders']['count']);
        $this->assertSame(200.0, (float) $cur['service_orders']['gross_margin']);

        // Expenses: 6 500 payroll + 300 ordinary charge
        $this->assertSame(6800.0, (float) $cur['expenses']['total']);
        $this->assertSame('Charges RH', $cur['expenses']['by_category'][0]['category']);
        $this->assertSame(6500.0, (float) $cur['expenses']['by_category'][0]['amount']);

        // Payroll is a breakdown of the expenses above, not an addition
        $this->assertSame(6500.0, (float) $cur['payroll']['total']);
        $this->assertSame(6500.0, (float) $cur['payroll']['by_subcategory']['Salaire']);
        $this->assertSame(1, $cur['payroll']['employee_count']);

        // Margin: 600 (sales) + 200 (service) = 800 gross; net = 800 − 6 800
        $this->assertSame(800.0, (float) $cur['margin']['gross']);
        $this->assertSame(-6000.0, (float) $cur['margin']['net']);

        // Cash flow: only the two expense transactions exist as cash movements
        $this->assertSame(6800.0, (float) $cur['cash_flow']['expense_settled']);

        // Commercials and brands
        $this->assertSame('Admin Reporting', $cur['commercials'][0]['commercial_name']);
        $this->assertSame(1300.0, (float) $cur['commercials'][0]['total_sales']);
        $this->assertSame(2, $cur['commercials'][0]['total_tyres']);
        $this->assertSame('ReportBrand', $cur['top_brands'][0]['brand']);
        $this->assertSame(2, $cur['top_brands'][0]['tyres_qty']);
        $this->assertSame(100.0, (float) $cur['top_brands'][0]['share_pct']);
        $this->assertSame(800.0, (float) $cur['top_brands'][0]['total_sales']);
        $this->assertSame(400.0, (float) $cur['top_brands'][0]['margin']);

        // February 2015 is empty
        $this->assertSame(0.0, (float) $response->json('previous.sales.total'));
    }

    public function test_previous_block_covers_the_month_before(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $this->seedMarch2015();

        $response = $this->getJson('/api/reporting/monthly?year=2015&month=4')->assertOk();

        $response
            ->assertJsonPath('previous_period.year', 2015)
            ->assertJsonPath('previous_period.month', 3);

        $this->assertSame(0.0, (float) $response->json('current.sales.total'));
        $this->assertSame(1300.0, (float) $response->json('previous.sales.total'));
        $this->assertSame(6500.0, (float) $response->json('previous.payroll.total'));
    }

    public function test_january_previous_period_rolls_back_to_december(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->getJson('/api/reporting/monthly?year=2015&month=1')
            ->assertOk()
            ->assertJsonPath('previous_period.year', 2014)
            ->assertJsonPath('previous_period.month', 12)
            ->assertJsonPath('previous_period.start', '2014-12-01')
            ->assertJsonPath('previous_period.end', '2014-12-31');
    }

    // -------------------------------------------------------------------------
    // Fixtures
    // -------------------------------------------------------------------------

    private function createUser(string $name): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
    }

    private function seedMarch2015(): void
    {
        $account = Account::query()->create([
            'name' => 'Compte Reporting '.fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        // --- Sales ---------------------------------------------------------
        $invoiced = $this->createSale(['with_invoice' => true, 'total_sale' => 800, 'total_purchase' => 400, 'margin' => 400, 'payment_status' => 'PARTIEL']);
        SaleItem::query()->create([
            'sale_id' => $invoiced->id,
            'product_id' => $this->tyre->id,
            'quantity' => 2,
            'purchase_price' => 200,
            'selling_price' => 400,
            'discount' => 0,
            'total_purchase' => 400,
            'total_sale' => 800,
            'margin' => 400,
        ]);

        $this->createSale(['with_invoice' => false, 'total_sale' => 500, 'total_purchase' => 300, 'margin' => 200, 'payment_status' => 'PAYE']);
        $this->createSale(['with_invoice' => true, 'total_sale' => 999, 'total_purchase' => 1, 'margin' => 998, 'status' => 'ANNULE']);

        $payment = Payment::query()->create([
            'sale_id' => $invoiced->id,
            'amount' => 300,
            'date' => '2015-03-12',
            'method' => 'Espèces',
            'user_id' => $this->admin->id,
        ]);
        SalePaymentAllocation::query()->create(['payment_id' => $payment->id, 'sale_id' => $invoiced->id, 'amount' => 300]);

        // --- Purchases -----------------------------------------------------
        $supplier = Supplier::query()->create(['name' => 'Fournisseur Reporting', 'user_id' => $this->admin->id]);

        $purchase = Purchase::query()->create([
            'date' => '2015-03-08',
            'with_invoice' => true,
            'supplier_id' => $supplier->id,
            'total_quantity' => 4,
            'total_price' => 1000,
            'discount' => 10,
            'net_amount' => 900,
            'status' => 'RECU',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);
        PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $this->tyre->id,
            'quantity' => 4,
            'unit_price' => 250,
        ]);

        Purchase::query()->create([
            'date' => '2015-03-20',
            'with_invoice' => false,
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 400,
            'discount' => 0,
            'net_amount' => 400,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        // --- Service Auto --------------------------------------------------
        $order = ServiceOrder::query()->create([
            'date' => '2015-03-15',
            'vehicle' => 'Renault Clio',
            'mileage' => 50000,
            'total_amount' => 200,
            'discount' => 0,
            'net_amount' => 200,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->admin->id,
            'created_by' => $this->admin->id,
        ]);
        ServiceItem::query()->create([
            'service_order_id' => $order->id,
            'item_type' => 'service',
            'service_type' => 'Vidange',
            'quantity' => 1,
            'parts_cost' => 0,
            'labor_cost' => 200,
            'line_total' => 200,
            'sort_order' => 0,
        ]);

        // --- Expenses ------------------------------------------------------
        Transaction::query()->create([
            'date' => '2015-03-05',
            'amount' => 6500,
            'type' => 'expense',
            'category' => 'Charges RH',
            'subcategory' => 'Salaire',
            'method' => 'Virement',
            'person' => $this->manager->name,
            'employee_id' => $this->manager->id,
            'description' => 'Paie de mars',
            'account_id' => $account->id,
            'user_id' => $this->admin->id,
        ]);

        Transaction::query()->create([
            'date' => '2015-03-18',
            'amount' => 300,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Électricité',
            'description' => 'Facture électricité',
            'account_id' => $account->id,
            'user_id' => $this->admin->id,
        ]);
    }

    private function createSale(array $overrides): Sale
    {
        return Sale::query()->create(array_merge([
            'date' => '2015-03-10',
            'with_invoice' => false,
            'total_quantity' => 1,
            'total_purchase' => 0,
            'total_sale' => 0,
            'margin' => 0,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->admin->id,
            'created_by' => $this->admin->id,
        ], $overrides));
    }
}
