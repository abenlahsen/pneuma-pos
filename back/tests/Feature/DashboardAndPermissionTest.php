<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Sale;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class DashboardAndPermissionTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $nonAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view roles', 'create roles', 'edit roles', 'delete roles'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $commercialRole = Role::findOrCreate('Commercial', 'web');
        $commercialRole->syncPermissions(['view roles']);

        $this->admin = User::query()->create([
            'name' => 'Admin User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->admin->assignRole($adminRole);

        $this->nonAdmin = User::query()->create([
            'name' => 'Commercial User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->nonAdmin->assignRole($commercialRole);
    }

    // =========================================================================
    // GET /api/dashboard-kpi
    // =========================================================================

    public function test_kpi_requires_authentication(): void
    {
        $this->getJson('/api/dashboard-kpi')->assertUnauthorized();
    }

    public function test_kpi_requires_administrator_role(): void
    {
        Sanctum::actingAs($this->nonAdmin, [], 'web');

        $this->getJson('/api/dashboard-kpi')->assertForbidden();
    }

    public function test_kpi_returns_expected_keys(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/dashboard-kpi');

        $response->assertOk()
            ->assertJsonStructure([
                'sales_today_amount',
                'tyres_today',
                'margin_today',
                'sales_month_amount',
                'purchases_month_amount',
                'margin_month',
                'margin_year',
                'total_sale_year',
                'total_purchase_year',
                'tyres_month',
                'tyres_year',
                'tyres_purchased_month',
                'sales_by_commercial',
                'stock_quantity',
                'stock_value',
                'unpaid_sales',
                'unpaid_purchases',
                'cash_balance',
            ]);
    }

    public function test_kpi_returns_correct_sales_today(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $today = now()->toDateString();

        Sale::query()->create([
            'date' => $today,
            'total_quantity' => 4,
            'total_purchase' => 400.00,
            'total_sale' => 800.00,
            'margin' => 400.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/dashboard-kpi');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(800, $response->json('sales_today_amount'));
        $this->assertGreaterThanOrEqual(4, $response->json('tyres_today'));
    }

    public function test_kpi_accepts_custom_day_filter(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/dashboard-kpi?day=2026-01-15&month=2026-01&year=2026');

        $response->assertOk();
    }

    public function test_kpi_returns_stock_value(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/dashboard-kpi');

        $response->assertOk();
        $this->assertIsNumeric($response->json('stock_value'));
        $this->assertIsInt($response->json('stock_quantity'));
    }

    public function test_kpi_returns_cash_balance(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        Account::query()->create([
            'name' => 'Caisse KPI ' . fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 5000.00,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/dashboard-kpi');

        $response->assertOk();
        $this->assertIsNumeric($response->json('cash_balance'));
    }

    public function test_kpi_returns_sales_by_commercial(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/dashboard-kpi');

        $response->assertOk();
        $this->assertIsArray($response->json('sales_by_commercial'));
    }

    // =========================================================================
    // GET /api/permissions
    // =========================================================================

    public function test_permissions_index_requires_authentication(): void
    {
        $this->getJson('/api/permissions')->assertUnauthorized();
    }

    public function test_permissions_index_requires_view_roles_permission(): void
    {
        $user = $this->createUserWithNoPermissions();
        Sanctum::actingAs($user, [], 'web');

        $this->getJson('/api/permissions')->assertForbidden();
    }

    public function test_permissions_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/permissions');

        $response->assertOk()
            ->assertJsonStructure(['current_page', 'data', 'total', 'last_page', 'per_page']);
    }

    public function test_permissions_index_returns_all_when_flag_set(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/permissions?all=1');

        $response->assertOk();
        $this->assertIsArray($response->json());
    }

    // =========================================================================
    // POST /api/permissions
    // =========================================================================

    public function test_permissions_store_requires_create_roles_permission(): void
    {
        Sanctum::actingAs($this->nonAdmin, [], 'web');

        $this->postJson('/api/permissions', ['name' => 'new perm'])->assertForbidden();
    }

    public function test_permissions_store_validates_unique_name(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/permissions', ['name' => 'view roles'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_permissions_store_validates_required_name(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/permissions', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_permissions_store_creates_permission(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $uniqueName = 'custom permission ' . fake()->unique()->numerify('###');

        $response = $this->postJson('/api/permissions', ['name' => $uniqueName]);

        $response->assertCreated()
            ->assertJsonPath('name', $uniqueName);

        $this->assertDatabaseHas('permissions', ['name' => $uniqueName]);
    }

    // =========================================================================
    // DELETE /api/permissions/{id}
    // =========================================================================

    public function test_permissions_destroy_requires_delete_roles_permission(): void
    {
        Sanctum::actingAs($this->nonAdmin, [], 'web');

        $perm = Permission::findOrCreate('to delete perm ' . fake()->unique()->numerify('#'), 'web');

        $this->deleteJson("/api/permissions/{$perm->id}")->assertForbidden();
    }

    public function test_permissions_destroy_deletes_permission(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $perm = Permission::create(['name' => 'perm to delete ' . fake()->unique()->numerify('###'), 'guard_name' => 'web']);

        $this->deleteJson("/api/permissions/{$perm->id}")->assertStatus(204);

        $this->assertDatabaseMissing('permissions', ['id' => $perm->id]);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function createUserWithNoPermissions(): User
    {
        $user = User::query()->create([
            'name' => 'No Perm User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        return $user;
    }

    // =========================================================================
    // Table setup (SQLite in-memory)
    // =========================================================================

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensureSalesTable();
        $this->ensurePurchasesTable();
        $this->ensureStocksTable();
        $this->ensurePaymentsTable();
    }

    private function ensureUsersTable(): void
    {
        if (Schema::hasTable('users')) {
            return;
        }
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->decimal('commission_rate', 8, 2)->default(0);
            $table->boolean('must_change_password')->default(false);
            $table->rememberToken();
            $table->timestamps();
        });
    }

    private function ensurePersonalAccessTokensTable(): void
    {
        if (Schema::hasTable('personal_access_tokens')) {
            return;
        }
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePermissionTables(): void
    {
        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('name');
                $table->string('guard_name');
                $table->timestamps();
                $table->unique(['name', 'guard_name']);
            });
        }
        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('name');
                $table->string('guard_name');
                $table->timestamps();
                $table->unique(['name', 'guard_name']);
            });
        }
        if (! Schema::hasTable('model_has_permissions')) {
            Schema::create('model_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
                $table->primary(['permission_id', 'model_id', 'model_type'], 'dp_mhp_primary');
            });
        }
        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['role_id', 'model_id', 'model_type'], 'dp_mhr_primary');
            });
        }
        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->unsignedBigInteger('role_id');
                $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['permission_id', 'role_id'], 'dp_rhp_primary');
            });
        }
    }

    private function ensureAccountsTable(): void
    {
        if (Schema::hasTable('accounts')) {
            return;
        }
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('type');
            $table->text('description')->nullable();
            $table->decimal('initial_balance', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureTransactionsTable(): void
    {
        if (Schema::hasTable('transactions')) {
            return;
        }
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('type')->nullable();
            $table->string('category')->nullable();
            $table->string('method')->nullable();
            $table->string('description')->nullable();
            $table->string('person')->nullable();
            $table->string('partner')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->unsignedBigInteger('transfer_id')->nullable();
            $table->timestamps();
        });
    }

    private function ensureSalesTable(): void
    {
        if (Schema::hasTable('sales')) {
            return;
        }
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->boolean('with_invoice')->default(false);
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_purchase', 12, 2)->default(0);
            $table->decimal('total_sale', 12, 2)->default(0);
            $table->decimal('margin', 12, 2)->default(0);
            $table->unsignedBigInteger('carrier_id')->nullable();
            $table->string('tracking_number')->nullable();
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->string('service')->nullable();
            $table->decimal('service_fee', 12, 2)->default(0);
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('payment_method')->nullable();
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->date('delivery_date')->nullable();
            $table->text('comments')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePurchasesTable(): void
    {
        if (Schema::hasTable('purchases')) {
            return;
        }
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_price', 12, 2)->default(0);
            $table->string('payment_status')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensureStocksTable(): void
    {
        if (Schema::hasTable('stocks')) {
            return;
        }
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('made_in')->nullable();
            $table->string('dot')->nullable();
            $table->string('depot')->nullable();
            $table->string('zone')->nullable();
            $table->integer('quantity')->default(0);
            $table->decimal('purchase_price', 12, 2)->default(0);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePaymentsTable(): void
    {
        if (Schema::hasTable('payments')) {
            return;
        }
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_id');
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date')->nullable();
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }
}
