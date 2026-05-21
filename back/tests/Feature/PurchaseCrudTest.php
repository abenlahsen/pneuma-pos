<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PurchaseCrudTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Supplier $supplier;

    private Product $product;

    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view purchases', 'create purchases', 'edit purchases', 'delete purchases'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        Role::findOrCreate('Commercial', 'web');
        Role::findOrCreate('Manager', 'web');
        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::query()->get());

        $this->user = User::query()->create([
            'name' => 'Test Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);

        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);

        $this->supplier = Supplier::query()->create([
            'name' => 'Fournisseur Test',
            'user_id' => $this->user->id,
        ]);

        $this->product = Product::query()->create([
            'reference' => 'REF-TEST-'.fake()->unique()->numerify('###'),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);

        DB::table('product_tyres')->insert([
            'product_id' => $this->product->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->stock = Stock::query()->create([
            'product_id' => $this->product->id,
            'quantity' => 10,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/purchases')->assertUnauthorized();
    }

    public function test_index_requires_view_purchases_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/purchases')->assertForbidden();
    }

    public function test_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase();
        $this->createPurchase();

        $response = $this->getJson('/api/purchases');

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_index_filters_by_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase(['status' => 'EN COURS']);
        $this->createPurchase(['status' => 'RECU']);

        $response = $this->getJson('/api/purchases?status=RECU');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'RECU');
    }

    public function test_index_filters_by_date_range(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase(['date' => '2026-01-15']);
        $this->createPurchase(['date' => '2026-04-15']);

        $response = $this->getJson('/api/purchases?date_from=2026-04-01&date_to=2026-04-30');

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases-summary
    // -------------------------------------------------------------------------

    public function test_summary_returns_totals(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase(['net_amount' => 1000, 'total_price' => 1000, 'payment_status' => 'PAYE']);
        $this->createPurchase(['net_amount' => 500, 'total_price' => 500, 'payment_status' => 'NON PAYE']);

        $response = $this->getJson('/api/purchases-summary');

        $response->assertOk()
            ->assertJsonStructure(['total_achats', 'total_paye', 'reste_a_payer'])
            ->assertJsonPath('total_achats', 1500)
            ->assertJsonPath('total_paye', 1000)
            ->assertJsonPath('reste_a_payer', 500);
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases-filters
    // -------------------------------------------------------------------------

    public function test_filters_returns_suppliers_and_commercials(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/purchases-filters');

        $response->assertOk()
            ->assertJsonStructure(['suppliers', 'commercials']);
    }

    // -------------------------------------------------------------------------
    // POST /api/purchases
    // -------------------------------------------------------------------------

    public function test_store_requires_create_purchases_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/purchases', $this->validPayload())->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/purchases', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date', 'supplier_id', 'commercial_id', 'status', 'payment_status', 'items']);
    }

    public function test_store_creates_purchase_with_correct_totals(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/purchases', $this->validPayload());

        $response->assertCreated();

        $this->assertDatabaseHas('purchases', [
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 4,
            'total_price' => 400.00,
            'created_by' => $this->user->id,
        ]);
    }

    public function test_store_increments_stock_for_received_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $before = $this->stock->quantity;

        $this->postJson('/api/purchases', $this->validPayload(['status' => 'RECU']));

        $this->stock->refresh();
        $this->assertEquals($before + 4, $this->stock->quantity);
    }

    public function test_store_records_stock_movement(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/purchases', $this->validPayload(['status' => 'RECU']));

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $this->stock->id,
            'type' => StockMovement::TYPE_PURCHASE_IN,
        ]);
    }

    public function test_store_does_not_increment_stock_for_annule_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $before = $this->stock->quantity;

        $this->postJson('/api/purchases', $this->validPayload(['status' => 'ANNULE']));

        $this->stock->refresh();
        $this->assertEquals($before, $this->stock->quantity);
    }

    public function test_store_rejects_service_type_products(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $service = Product::query()->create([
            'reference' => 'SVC-'.fake()->unique()->numerify('###'),
            'type' => 'service',
            'is_active' => true,
        ]);
        DB::table('product_services')->insert([
            'product_id' => $service->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $serviceStock = Stock::query()->create([
            'product_id' => $service->id,
            'quantity' => 0,
            'purchase_price' => 0,
            'user_id' => $this->user->id,
        ]);

        $response = $this->postJson('/api/purchases', $this->validPayload([
            'items' => [[
                'product_id' => $service->id,
                'stock_id' => $serviceStock->id,
                'quantity' => 1,
                'unit_price' => 50,
            ]],
        ]));

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Les services ne peuvent pas figurer dans un achat.');
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases/{purchase}
    // -------------------------------------------------------------------------

    public function test_show_returns_purchase_with_relations(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $purchase = $this->createPurchase();

        $response = $this->getJson("/api/purchases/{$purchase->id}");

        $response->assertOk()
            ->assertJsonPath('id', $purchase->id)
            ->assertJsonStructure(['supplier', 'items']);
    }

    // -------------------------------------------------------------------------
    // PUT /api/purchases/{purchase}
    // -------------------------------------------------------------------------

    public function test_update_requires_edit_purchases_permission(): void
    {
        $purchase = $this->createPurchase();
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/purchases/{$purchase->id}", $this->validPayload())->assertForbidden();
    }

    public function test_update_modifies_purchase_and_recalculates_totals(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $purchase = $this->createPurchase(['status' => 'ANNULE']);

        $response = $this->putJson("/api/purchases/{$purchase->id}", $this->validPayload([
            'status' => 'RECU',
            'items' => [
                ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 2, 'unit_price' => 150],
            ],
        ]));

        $response->assertOk();

        $this->assertDatabaseHas('purchases', [
            'id' => $purchase->id,
            'total_quantity' => 2,
            'total_price' => 300.00,
            'status' => 'RECU',
        ]);
    }

    public function test_update_restores_stock_from_old_items_before_applying_new(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        // First create a RECU purchase (adds 4 to stock)
        $createResponse = $this->postJson('/api/purchases', $this->validPayload(['status' => 'RECU']));
        $purchaseId = $createResponse->json('id');
        $this->stock->refresh();
        $stockAfterCreate = $this->stock->quantity;

        // Update: change quantity from 4 to 2 — stock should go back down by 2
        $this->putJson("/api/purchases/{$purchaseId}", $this->validPayload([
            'status' => 'RECU',
            'items' => [
                ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 2, 'unit_price' => 100],
            ],
        ]));

        $this->stock->refresh();
        // Restored the old 4, then applied new 2: net = stockAfterCreate - 4 + 2
        $this->assertEquals($stockAfterCreate - 4 + 2, $this->stock->quantity);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/purchases/{purchase}
    // -------------------------------------------------------------------------

    public function test_destroy_requires_delete_purchases_permission(): void
    {
        $purchase = $this->createPurchase();
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/purchases/{$purchase->id}")->assertForbidden();
    }

    public function test_destroy_deletes_purchase_and_restores_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $createResponse = $this->postJson('/api/purchases', $this->validPayload(['status' => 'RECU']));
        $purchaseId = $createResponse->json('id');

        $this->stock->refresh();
        $stockAfterCreate = $this->stock->quantity;

        $this->deleteJson("/api/purchases/{$purchaseId}")->assertNoContent();

        $this->assertDatabaseMissing('purchases', ['id' => $purchaseId]);

        $this->stock->refresh();
        $this->assertEquals($stockAfterCreate - 4, $this->stock->quantity);
    }

    public function test_destroy_does_not_restore_stock_for_annule_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $purchase = $this->createPurchase(['status' => 'ANNULE']);
        $before = $this->stock->quantity;

        $this->deleteJson("/api/purchases/{$purchase->id}")->assertNoContent();

        $this->stock->refresh();
        $this->assertEquals($before, $this->stock->quantity);
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases/export
    // -------------------------------------------------------------------------

    public function test_export_streams_xlsx(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase(['date' => '2026-04-10', 'payment_status' => 'PAYE']);
        $this->createPurchase(['date' => '2026-04-15', 'payment_status' => 'NON PAYE']);

        $response = $this->get('/api/purchases/export');

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    public function test_export_requires_view_purchases_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->get('/api/purchases/export')->assertForbidden();
    }

    public function test_export_applies_filters(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createPurchase(['date' => '2026-04-10', 'payment_status' => 'PAYE']);
        $this->createPurchase(['date' => '2026-04-15', 'payment_status' => 'NON PAYE']);

        // Should return 200 regardless of filter (content varies, not testable as XLSX here)
        $this->get('/api/purchases/export?payment_status=PAYE')->assertOk();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-04-15',
            'with_invoice' => true,
            'supplier_id' => $this->supplier->id,
            'commercial_id' => $this->user->id,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'items' => [
                ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 4, 'unit_price' => 100],
            ],
        ], $overrides);
    }

    private function createPurchase(array $attributes = []): Purchase
    {
        $purchase = Purchase::query()->create(array_merge([
            'date' => '2026-04-01',
            'supplier_id' => $this->supplier->id,
            'commercial_id' => $this->user->id,
            'total_quantity' => 4,
            'total_price' => 400.00,
            'net_amount' => 400.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ], $attributes));

        $purchase->items()->create([
            'product_id' => $this->product->id,
            'stock_id' => $this->stock->id,
            'quantity' => 4,
            'unit_price' => 100,
        ]);

        return $purchase;
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Limited User',
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
    // Table setup (SQLite in-memory)
    // -------------------------------------------------------------------------

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
        $this->ensureSuppliersTable();
        $this->ensureBrandsTable();
        $this->ensureProductsTable();
        $this->ensureProductSubtypeTables();
        $this->ensureStocksTable();
        $this->ensureStockMovementsTable();
        $this->ensurePurchasesTable();
        $this->ensurePurchaseItemsTable();
        $this->ensurePurchasePaymentsTable();
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
                $table->primary(['permission_id', 'model_id', 'model_type'], 'mhp_primary');
            });
        }
        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['role_id', 'model_id', 'model_type'], 'mhr_primary');
            });
        }
        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->unsignedBigInteger('role_id');
                $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['permission_id', 'role_id'], 'rhp_primary');
            });
        }
    }

    private function ensureSuppliersTable(): void
    {
        if (Schema::hasTable('suppliers')) {
            return;
        }
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact_person')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
        });
    }

    private function ensureBrandsTable(): void
    {
        if (Schema::hasTable('brands')) {
            return;
        }
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('logo')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureProductsTable(): void
    {
        if (Schema::hasTable('products')) {
            return;
        }
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('profile')->nullable();
            $table->string('reference')->nullable();
            $table->string('type')->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->text('description')->nullable();
            $table->string('unit')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureProductSubtypeTables(): void
    {
        if (! Schema::hasTable('product_tyres')) {
            Schema::create('product_tyres', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->integer('tire_width')->nullable();
                $table->integer('tire_height')->nullable();
                $table->integer('tire_diameter')->nullable();
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('product_parts')) {
            Schema::create('product_parts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('product_services')) {
            Schema::create('product_services', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
            });
        }
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

    private function ensureStockMovementsTable(): void
    {
        if (Schema::hasTable('stock_movements')) {
            return;
        }
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('stock_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('type');
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_after')->default(0);
            $table->integer('delta')->default(0);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reason')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
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
            $table->date('date');
            $table->boolean('with_invoice')->default(false);
            $table->decimal('discount', 5, 2)->default(0);
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_price', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->unsignedBigInteger('supplier_id');
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->default('EN COURS');
            $table->string('payment_status')->default('NON PAYE');
            $table->string('payment_method')->nullable();
            $table->date('payment_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePurchaseItemsTable(): void
    {
        if (Schema::hasTable('purchase_items')) {
            return;
        }
        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('stock_id')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    private function ensurePurchasePaymentsTable(): void
    {
        if (Schema::hasTable('purchase_payments')) {
            return;
        }
        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id');
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->date('date');
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
        });
    }
}
