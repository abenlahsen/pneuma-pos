<?php

namespace Tests\Feature;

use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class SupplierUnpaidSummaryTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Administrator role covers both endpoints under test: role:Administrator
        // for /api/dashboard-kpi and permission:view suppliers for /api/suppliers-summary.
        foreach (['view suppliers'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $this->admin = User::query()->create([
            'name' => 'Admin User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->admin->assignRole($adminRole);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Guest User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    // -------------------------------------------------------------------------
    // GET /api/suppliers-summary
    // -------------------------------------------------------------------------

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/suppliers-summary')->assertUnauthorized();
    }

    public function test_requires_view_suppliers_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/suppliers-summary')->assertForbidden();
    }

    public function test_row_split_matches_total(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $supplier = Supplier::query()->create([
            'name' => 'Fournisseur Summary Split',
            'user_id' => $this->admin->id,
        ]);

        Purchase::query()->create([
            'date' => now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 150.00,
            'net_amount' => 150.00,
            'with_invoice' => true,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        Purchase::query()->create([
            'date' => now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 250.00,
            'net_amount' => 250.00,
            'with_invoice' => false,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        $rows = $this->getJson('/api/suppliers-summary')->json('rows');
        $row = collect($rows)->firstWhere('supplier_id', $supplier->id);

        $this->assertNotNull($row);
        $this->assertEquals(400.00, $row['total_unpaid']);
        $this->assertEquals(150.00, $row['unpaid_with_invoice']);
        $this->assertEquals(250.00, $row['unpaid_without_invoice']);
    }

    public function test_excludes_cancelled_purchases(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $supplier = Supplier::query()->create([
            'name' => 'Fournisseur Summary Annule',
            'user_id' => $this->admin->id,
        ]);

        Purchase::query()->create([
            'date' => now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 999.00,
            'net_amount' => 999.00,
            'status' => 'ANNULE',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        $rows = $this->getJson('/api/suppliers-summary')->json('rows');
        $row = collect($rows)->firstWhere('supplier_id', $supplier->id);

        $this->assertNull($row);
    }

    public function test_excludes_fully_paid_suppliers(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $supplier = Supplier::query()->create([
            'name' => 'Fournisseur Summary Solde',
            'user_id' => $this->admin->id,
        ]);

        $purchase = Purchase::query()->create([
            'date' => now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 500.00,
            'net_amount' => 500.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        $payment = PurchasePayment::query()->create([
            'purchase_id' => $purchase->id,
            'supplier_id' => $supplier->id,
            'amount' => 500.00,
            'date' => now()->toDateString(),
            'method' => 'Espèces',
        ]);
        PurchasePaymentAllocation::query()->create([
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $purchase->id,
            'amount' => 500.00,
        ]);

        $rows = $this->getJson('/api/suppliers-summary')->json('rows');
        $row = collect($rows)->firstWhere('supplier_id', $supplier->id);

        $this->assertNull($row);
    }

    // Cross-endpoint regression: the dashboard's "Reste à payer (Frs)" card and
    // this page's table are now backed by two separate HTTP calls sharing the
    // same underlying SupplierService::unpaidBySupplier() — they must still
    // agree on the total.
    public function test_total_equals_sum_of_unpaid_purchases_on_dashboard_kpi(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $supplier = Supplier::query()->create([
            'name' => 'Fournisseur Summary CrossCheck',
            'user_id' => $this->admin->id,
        ]);

        Purchase::query()->create([
            'date' => now()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 321.00,
            'net_amount' => 321.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        $summary = $this->getJson('/api/suppliers-summary')->json();
        $dashboard = $this->getJson('/api/dashboard-kpi')->json();

        $sumOfRows = array_sum(array_column($summary['rows'], 'total_unpaid'));

        $this->assertEqualsWithDelta($summary['total'], $sumOfRows, 0.01);
        $this->assertEqualsWithDelta($dashboard['unpaid_purchases'], $summary['total'], 0.01);
    }
}
