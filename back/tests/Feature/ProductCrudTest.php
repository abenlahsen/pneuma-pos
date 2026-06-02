<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
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

class ProductCrudTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Brand $brand;
    private Product $tyreProduct;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view products', 'create products', 'edit products', 'delete products'] as $perm) {
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

        $this->brand = Brand::query()->create(['name' => 'TestBrand-' . uniqid(), 'is_active' => true]);

        $this->tyreProduct = Product::query()->create([
            'reference' => 'MIC-2055516-' . fake()->unique()->numerify('###'),
            'type' => 'tyre',
            'brand_id' => $this->brand->id,
            'is_active' => true,
        ]);

        DB::table('product_tyres')->insert([
            'product_id' => $this->tyreProduct->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'created_at' => now(),
            'updated_at' => now(),
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
                $t->string('reference')->nullable();
                $t->string('type', 20)->default('tyre');
                $t->string('profile')->nullable();
                $t->string('description')->nullable();
                $t->string('unit', 50)->nullable();
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
                $t->string('tire_load_index', 20)->nullable();
                $t->string('tire_speed_index', 10)->nullable();
                $t->string('tire_season', 20)->nullable();
                $t->boolean('tire_runflat')->default(false);
                $t->boolean('tire_reinforced')->default(false);
                $t->string('tire_marking')->nullable();
                $t->char('eu_fuel', 1)->nullable();
                $t->char('eu_wet_grip', 1)->nullable();
                $t->smallInteger('eu_noise_db')->nullable();
                $t->char('eu_noise_class', 1)->nullable();
                $t->timestamps();
                $t->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('product_parts')) {
            Schema::create('product_parts', function (Blueprint $t) {
                $t->unsignedBigInteger('product_id')->primary();
                $t->string('category', 50)->default('other');
                $t->string('oem_reference')->nullable();
                $t->text('compatibility')->nullable();
                $t->timestamps();
                $t->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('product_services')) {
            Schema::create('product_services', function (Blueprint $t) {
                $t->unsignedBigInteger('product_id')->primary();
                $t->string('category', 50)->default('other');
                $t->smallInteger('duration_minutes')->nullable();
                $t->decimal('selling_price', 10, 2)->nullable();
                $t->timestamps();
                $t->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
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
    // GET /api/products
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/products')->assertUnauthorized();
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

        $this->getJson('/api/products')->assertForbidden();
    }

    public function test_index_returns_paginated_products(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/products');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total', 'current_page', 'per_page']);

        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_index_filters_by_type(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/products?type=tyre');
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertEquals('tyre', $item['type']);
        }
    }

    public function test_index_filters_by_brand(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/products?brand_id={$this->brand->id}");
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertEquals($this->brand->id, $item['brand_id']);
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/products-filters
    // -------------------------------------------------------------------------

    public function test_filters_returns_options(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/products-filters');

        $response->assertOk()
            ->assertJsonStructure(['brands', 'types', 'seasons']);

        $this->assertContains('tyre', $response->json('types'));
        $this->assertContains('part', $response->json('types'));
        $this->assertContains('service', $response->json('types'));
    }

    // -------------------------------------------------------------------------
    // POST /api/products
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/products', [])->assertUnauthorized();
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

        $this->postJson('/api/products', ['type' => 'tyre'])->assertForbidden();
    }

    public function test_store_validates_required_type(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/products', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_store_validates_type_enum(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/products', ['type' => 'invalid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_store_validates_unique_reference(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/products', [
            'type' => 'tyre',
            'reference' => $this->tyreProduct->reference,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['reference']);
    }

    public function test_store_creates_tyre_product_with_details_and_zero_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $ref = 'PIR-' . fake()->unique()->numerify('######');

        $response = $this->postJson('/api/products', [
            'type' => 'tyre',
            'reference' => $ref,
            'brand_id' => $this->brand->id,
            'tire_width' => 225,
            'tire_height' => 45,
            'tire_diameter' => 17,
            'tire_season' => 'summer',
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'tyre')
            ->assertJsonPath('reference', $ref);

        $productId = $response->json('id');

        $this->assertDatabaseHas('products', ['id' => $productId, 'type' => 'tyre']);
        $this->assertDatabaseHas('product_tyres', [
            'product_id' => $productId,
            'tire_width' => 225,
            'tire_height' => 45,
            'tire_diameter' => 17,
        ]);
        $this->assertDatabaseHas('stocks', [
            'product_id' => $productId,
            'quantity' => 0,
        ]);
    }

    public function test_store_creates_service_product_without_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/products', [
            'type' => 'service',
            'reference' => 'SVC-MONTAGE-' . fake()->unique()->numerify('###'),
            'service_category' => 'tires',
            'selling_price' => 150.00,
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'service');

        $productId = $response->json('id');

        $this->assertDatabaseHas('product_services', ['product_id' => $productId]);
        $this->assertDatabaseMissing('stocks', ['product_id' => $productId]);
    }

    public function test_store_creates_part_product(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/products', [
            'type' => 'part',
            'reference' => 'PART-BRAKE-' . fake()->unique()->numerify('###'),
            'part_category' => 'brakes',
            'oem_reference' => 'OEM-12345',
        ]);

        $response->assertCreated()
            ->assertJsonPath('type', 'part');

        $productId = $response->json('id');

        $this->assertDatabaseHas('product_parts', [
            'product_id' => $productId,
            'category' => 'brakes',
            'oem_reference' => 'OEM-12345',
        ]);
        $this->assertDatabaseHas('stocks', ['product_id' => $productId]);
    }

    // -------------------------------------------------------------------------
    // GET /api/products/{product}
    // -------------------------------------------------------------------------

    public function test_show_returns_product_with_relations(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/products/{$this->tyreProduct->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->tyreProduct->id)
            ->assertJsonPath('type', 'tyre')
            ->assertJsonStructure(['id', 'type', 'brand', 'tyre']);
    }

    public function test_show_returns_404_for_unknown_product(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->getJson('/api/products/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // PUT /api/products/{product}
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

        $this->putJson("/api/products/{$this->tyreProduct->id}", [
            'type' => 'tyre',
        ])->assertForbidden();
    }

    public function test_update_modifies_product_and_tyre_details(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->putJson("/api/products/{$this->tyreProduct->id}", [
            'type' => 'tyre',
            'profile' => 'Primacy 4',
            'tire_width' => 215,
            'tire_height' => 60,
            'tire_diameter' => 17,
        ]);

        $response->assertOk()
            ->assertJsonPath('profile', 'Primacy 4');

        $this->assertDatabaseHas('product_tyres', [
            'product_id' => $this->tyreProduct->id,
            'tire_width' => 215,
            'tire_height' => 60,
        ]);
    }

    // -------------------------------------------------------------------------
    // PATCH /api/products/{product}/toggle-active
    // -------------------------------------------------------------------------

    public function test_toggle_active_switches_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->assertTrue($this->tyreProduct->is_active);

        $response = $this->patchJson("/api/products/{$this->tyreProduct->id}/toggle-active");

        $response->assertOk()
            ->assertJsonPath('is_active', false);

        $this->assertDatabaseHas('products', [
            'id' => $this->tyreProduct->id,
            'is_active' => false,
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/products/{product}
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

        $this->deleteJson("/api/products/{$this->tyreProduct->id}")->assertForbidden();
    }

    public function test_destroy_deletes_product(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $productId = $this->tyreProduct->id;

        $this->deleteJson("/api/products/{$productId}")->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $productId]);
    }

    public function test_destroy_returns_404_for_unknown_product(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->deleteJson('/api/products/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // Profile filter & is_active filter
    // -------------------------------------------------------------------------

    public function test_index_filters_by_profile(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $suffix = fake()->unique()->numerify('###');

        $withProfile = Product::query()->create([
            'reference' => 'REF-PROF-' . $suffix,
            'type' => 'tyre',
            'profile' => 'Sport',
            'is_active' => true,
        ]);

        Product::query()->create([
            'reference' => 'REF-NO-PROF-' . $suffix,
            'type' => 'tyre',
            'profile' => null,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/products?profile=Sport&per_page=100');
        $response->assertOk();

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertContains($withProfile->id, $ids->all());
        foreach ($response->json('data') as $item) {
            $this->assertEquals('Sport', $item['profile']);
        }
    }

    public function test_index_filters_by_is_active(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $suffix = fake()->unique()->numerify('###');

        $inactive = Product::query()->create([
            'reference' => 'REF-INACTIVE-' . $suffix,
            'type' => 'tyre',
            'is_active' => false,
        ]);

        $responseActive = $this->getJson('/api/products?is_active=1&per_page=100');
        $responseActive->assertOk();
        $activeIds = collect($responseActive->json('data'))->pluck('id');
        $this->assertNotContains($inactive->id, $activeIds->all());

        $responseInactive = $this->getJson('/api/products?is_active=0&per_page=100');
        $responseInactive->assertOk();
        $inactiveIds = collect($responseInactive->json('data'))->pluck('id');
        $this->assertContains($inactive->id, $inactiveIds->all());
    }

    public function test_filters_returns_profiles_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $suffix = fake()->unique()->numerify('###');

        Product::query()->create([
            'reference' => 'REF-SPORT-' . $suffix,
            'type' => 'tyre',
            'profile' => 'Profil-' . $suffix,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/products-filters');
        $response->assertOk()->assertJsonStructure(['brands', 'types', 'seasons', 'profiles']);

        $this->assertContains('Profil-' . $suffix, $response->json('profiles'));
    }
}
