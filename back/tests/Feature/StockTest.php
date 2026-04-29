<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Stock;
use App\Models\StockMovement;
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

class StockTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Brand $brand;
    private Product $tyreProd;
    private Product $serviceProd;
    private Stock $stock;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view stock',
            'create stock',
            'edit stock',
            'delete stock',
            'import stock',
            'view stock-movements',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

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

        $this->brand = Brand::query()->create(['name' => 'Michelin', 'is_active' => true]);

        $this->tyreProd = Product::query()->create([
            'reference' => 'TYRE-' . fake()->unique()->numerify('###'),
            'type' => 'tyre',
            'brand_id' => $this->brand->id,
            'is_active' => true,
        ]);

        DB::table('product_tyres')->insert([
            'product_id' => $this->tyreProd->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->serviceProd = Product::query()->create([
            'reference' => 'SVC-' . fake()->unique()->numerify('###'),
            'type' => 'service',
            'brand_id' => $this->brand->id,
            'is_active' => true,
        ]);

        DB::table('product_services')->insert([
            'product_id' => $this->serviceProd->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->stock = Stock::query()->create([
            'product_id' => $this->tyreProd->id,
            'quantity' => 10,
            'purchase_price' => 120.00,
            'depot' => 'Depot1',
            'made_in' => 'France',
            'user_id' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function ensureTablesExist(): void
    {
        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->string('email')->unique();
                $t->string('password');
                $t->string('phone')->nullable();
                $t->decimal('commission_rate', 5, 2)->default(0);
                $t->boolean('must_change_password')->default(false);
                $t->rememberToken();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('personal_access_tokens')) {
            Schema::create('personal_access_tokens', function (Blueprint $t) {
                $t->id();
                $t->morphs('tokenable');
                $t->string('name');
                $t->string('token', 64)->unique();
                $t->text('abilities')->nullable();
                $t->timestamp('last_used_at')->nullable();
                $t->timestamp('expires_at')->nullable();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->string('guard_name');
                $t->timestamps();
                $t->unique(['name', 'guard_name']);
            });
        }

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->string('guard_name');
                $t->timestamps();
                $t->unique(['name', 'guard_name']);
            });
        }

        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $t) {
                $t->unsignedBigInteger('permission_id');
                $t->unsignedBigInteger('role_id');
                $t->primary(['permission_id', 'role_id']);
            });
        }

        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $t) {
                $t->unsignedBigInteger('role_id');
                $t->string('model_type');
                $t->unsignedBigInteger('model_id');
                $t->index(['model_id', 'model_type']);
                $t->primary(['role_id', 'model_id', 'model_type']);
            });
        }

        if (! Schema::hasTable('model_has_permissions')) {
            Schema::create('model_has_permissions', function (Blueprint $t) {
                $t->unsignedBigInteger('permission_id');
                $t->string('model_type');
                $t->unsignedBigInteger('model_id');
                $t->index(['model_id', 'model_type']);
                $t->primary(['permission_id', 'model_id', 'model_type']);
            });
        }

        if (! Schema::hasTable('brands')) {
            Schema::create('brands', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('products')) {
            Schema::create('products', function (Blueprint $t) {
                $t->id();
                $t->string('reference')->unique();
                $t->string('type', 20)->default('tyre');
                $t->string('profile')->nullable();
                $t->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $t->boolean('is_active')->default(true);
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('product_tyres')) {
            Schema::create('product_tyres', function (Blueprint $t) {
                $t->unsignedBigInteger('product_id')->primary();
                $t->smallInteger('tire_width')->nullable();
                $t->smallInteger('tire_height')->nullable();
                $t->smallInteger('tire_diameter')->nullable();
                $t->string('tire_marking', 100)->nullable();
                $t->boolean('tire_runflat')->default(false);
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('product_parts')) {
            Schema::create('product_parts', function (Blueprint $t) {
                $t->unsignedBigInteger('product_id')->primary();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('product_services')) {
            Schema::create('product_services', function (Blueprint $t) {
                $t->unsignedBigInteger('product_id')->primary();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('stocks')) {
            Schema::create('stocks', function (Blueprint $t) {
                $t->id();
                $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
                $t->string('made_in', 100)->nullable();
                $t->string('dot', 50)->nullable();
                $t->string('depot', 100)->nullable();
                $t->string('zone', 50)->nullable();
                $t->integer('quantity')->default(0);
                $t->decimal('purchase_price', 10, 2)->nullable();
                $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('stock_movements')) {
            Schema::create('stock_movements', function (Blueprint $t) {
                $t->id();
                $t->foreignId('stock_id')->nullable()->constrained()->nullOnDelete();
                $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
                $t->string('type', 32);
                $t->integer('quantity_before');
                $t->integer('quantity_after');
                $t->integer('delta');
                $t->string('reference_type')->nullable();
                $t->unsignedBigInteger('reference_id')->nullable();
                $t->text('reason')->nullable();
                $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $t->timestamps();
            });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/stocks
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/stocks')->assertUnauthorized();
    }

    public function test_index_requires_permission(): void
    {
        $noPerms = User::query()->create([
            'name' => 'No Perms',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($noPerms, [], 'web');

        $this->getJson('/api/stocks')->assertForbidden();
    }

    public function test_index_returns_paginated_stocks(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stocks');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total', 'current_page', 'per_page']);

        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_index_filters_by_depot(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stocks?depot=Depot1');
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertEquals('Depot1', $item['depot']);
        }
    }

    public function test_index_filters_by_brand(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stocks?brand=Michelin');
        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    // -------------------------------------------------------------------------
    // GET /api/stocks-summary
    // -------------------------------------------------------------------------

    public function test_summary_returns_totals(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stocks-summary');

        $response->assertOk()
            ->assertJsonStructure(['total_articles', 'total_quantity', 'total_purchase_value'])
            ->assertJsonPath('total_articles', 1)
            ->assertJsonPath('total_quantity', 10);
    }

    // -------------------------------------------------------------------------
    // GET /api/stocks-filters
    // -------------------------------------------------------------------------

    public function test_filters_returns_filter_options(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stocks-filters');

        $response->assertOk()
            ->assertJsonStructure(['brands', 'depots', 'zones', 'countries']);

        $this->assertContains('Michelin', $response->json('brands'));
        $this->assertContains('Depot1', $response->json('depots'));
        $this->assertContains('France', $response->json('countries'));
    }

    // -------------------------------------------------------------------------
    // POST /api/stocks
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/stocks', [])->assertUnauthorized();
    }

    public function test_store_requires_permission(): void
    {
        $noPerms = User::query()->create([
            'name' => 'No Perms',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($noPerms, [], 'web');

        $this->postJson('/api/stocks', [
            'product_id' => $this->tyreProd->id,
            'quantity' => 5,
        ])->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/stocks', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['product_id', 'quantity']);
    }

    public function test_store_validates_product_exists(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/stocks', [
            'product_id' => 99999,
            'quantity' => 5,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['product_id']);
    }

    public function test_store_rejects_service_products(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/stocks', [
            'product_id' => $this->serviceProd->id,
            'quantity' => 5,
        ])->assertUnprocessable();
    }

    public function test_store_creates_stock_and_initial_movement(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/stocks', [
            'product_id' => $this->tyreProd->id,
            'quantity' => 8,
            'purchase_price' => 150.00,
            'depot' => 'DepotB',
            'made_in' => 'Germany',
        ]);

        $response->assertCreated()
            ->assertJsonPath('quantity', 8);

        $stockId = $response->json('id');

        $this->assertDatabaseHas('stocks', [
            'id' => $stockId,
            'product_id' => $this->tyreProd->id,
            'quantity' => 8,
            'depot' => 'DepotB',
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stockId,
            'type' => StockMovement::TYPE_INITIAL,
            'quantity_before' => 0,
            'quantity_after' => 8,
            'delta' => 8,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/stocks/{stock}
    // -------------------------------------------------------------------------

    public function test_show_returns_stock_with_relations(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/stocks/{$this->stock->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->stock->id)
            ->assertJsonStructure(['id', 'product' => ['id', 'brand', 'tyre']]);
    }

    public function test_show_returns_404_for_unknown_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->getJson('/api/stocks/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // PUT /api/stocks/{stock}
    // -------------------------------------------------------------------------

    public function test_update_requires_permission(): void
    {
        $noPerms = User::query()->create([
            'name' => 'No Perms',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000003',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($noPerms, [], 'web');

        $this->putJson("/api/stocks/{$this->stock->id}", ['depot' => 'X'])->assertForbidden();
    }

    public function test_update_modifies_non_quantity_fields_without_reason(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->putJson("/api/stocks/{$this->stock->id}", [
            'depot' => 'DepotC',
            'made_in' => 'Spain',
        ]);

        $response->assertOk()
            ->assertJsonPath('depot', 'DepotC');

        $this->assertDatabaseHas('stocks', [
            'id' => $this->stock->id,
            'depot' => 'DepotC',
            'made_in' => 'Spain',
        ]);

        $this->assertDatabaseMissing('stock_movements', [
            'stock_id' => $this->stock->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
        ]);
    }

    public function test_update_requires_reason_when_quantity_changes(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->putJson("/api/stocks/{$this->stock->id}", [
            'quantity' => 20,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_update_records_adjustment_movement_when_quantity_changes(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->putJson("/api/stocks/{$this->stock->id}", [
            'quantity' => 15,
            'reason' => 'Inventaire physique corrigé',
        ]);

        $response->assertOk()
            ->assertJsonPath('quantity', 15);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $this->stock->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_before' => 10,
            'quantity_after' => 15,
            'delta' => 5,
            'reason' => 'Inventaire physique corrigé',
        ]);
    }

    public function test_update_does_not_record_movement_when_quantity_unchanged(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $movementCountBefore = StockMovement::where('stock_id', $this->stock->id)
            ->where('type', StockMovement::TYPE_ADJUSTMENT)
            ->count();

        $this->putJson("/api/stocks/{$this->stock->id}", [
            'quantity' => 10,
            'depot' => 'SameQty',
        ])->assertOk();

        $movementCountAfter = StockMovement::where('stock_id', $this->stock->id)
            ->where('type', StockMovement::TYPE_ADJUSTMENT)
            ->count();

        $this->assertEquals($movementCountBefore, $movementCountAfter);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/stocks/{stock}
    // -------------------------------------------------------------------------

    public function test_destroy_requires_permission(): void
    {
        $noPerms = User::query()->create([
            'name' => 'No Perms',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000004',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($noPerms, [], 'web');

        $this->deleteJson("/api/stocks/{$this->stock->id}")->assertForbidden();
    }

    public function test_destroy_deletes_stock_and_records_deletion_movement(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $stockId = $this->stock->id;

        $this->deleteJson("/api/stocks/{$stockId}")->assertNoContent();

        $this->assertDatabaseMissing('stocks', ['id' => $stockId]);

        // stock_id becomes null due to ON DELETE SET NULL; match by product_id and type instead
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->tyreProd->id,
            'type' => StockMovement::TYPE_DELETION,
            'quantity_before' => 10,
            'quantity_after' => 0,
            'delta' => -10,
        ]);
    }

    public function test_destroy_returns_404_for_unknown_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->deleteJson('/api/stocks/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // GET /api/stock-movements
    // -------------------------------------------------------------------------

    public function test_movements_requires_authentication(): void
    {
        $this->getJson('/api/stock-movements')->assertUnauthorized();
    }

    public function test_movements_requires_permission(): void
    {
        $noPerms = User::query()->create([
            'name' => 'No Perms',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000005',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        Sanctum::actingAs($noPerms, [], 'web');

        $this->getJson('/api/stock-movements')->assertForbidden();
    }

    public function test_movements_returns_paginated_list(): void
    {
        StockMovement::query()->create([
            'stock_id' => $this->stock->id,
            'product_id' => $this->tyreProd->id,
            'type' => StockMovement::TYPE_INITIAL,
            'quantity_before' => 0,
            'quantity_after' => 10,
            'delta' => 10,
            'user_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stock-movements');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total', 'current_page', 'per_page']);

        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_movements_filters_by_stock_id(): void
    {
        $otherBrand = Brand::query()->create(['name' => 'Pirelli', 'is_active' => true]);
        $otherProd = Product::query()->create([
            'reference' => 'OTHER-' . fake()->unique()->numerify('###'),
            'type' => 'tyre',
            'brand_id' => $otherBrand->id,
            'is_active' => true,
        ]);
        DB::table('product_tyres')->insert([
            'product_id' => $otherProd->id,
            'tire_width' => 195,
            'tire_height' => 65,
            'tire_diameter' => 15,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $otherStock = Stock::query()->create([
            'product_id' => $otherProd->id,
            'quantity' => 5,
            'user_id' => $this->user->id,
        ]);

        StockMovement::query()->create([
            'stock_id' => $this->stock->id,
            'product_id' => $this->tyreProd->id,
            'type' => StockMovement::TYPE_INITIAL,
            'quantity_before' => 0,
            'quantity_after' => 10,
            'delta' => 10,
            'user_id' => $this->user->id,
        ]);

        StockMovement::query()->create([
            'stock_id' => $otherStock->id,
            'product_id' => $otherProd->id,
            'type' => StockMovement::TYPE_INITIAL,
            'quantity_before' => 0,
            'quantity_after' => 5,
            'delta' => 5,
            'user_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/stock-movements?stock_id={$this->stock->id}");
        $response->assertOk();

        foreach ($response->json('data') as $movement) {
            $this->assertEquals($this->stock->id, $movement['stock_id']);
        }
    }

    public function test_movements_filters_by_type(): void
    {
        StockMovement::query()->create([
            'stock_id' => $this->stock->id,
            'product_id' => $this->tyreProd->id,
            'type' => StockMovement::TYPE_ADJUSTMENT,
            'quantity_before' => 10,
            'quantity_after' => 15,
            'delta' => 5,
            'reason' => 'Correction',
            'user_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/stock-movements?type=' . StockMovement::TYPE_ADJUSTMENT);
        $response->assertOk();

        foreach ($response->json('data') as $movement) {
            $this->assertEquals(StockMovement::TYPE_ADJUSTMENT, $movement['type']);
        }
    }
}
