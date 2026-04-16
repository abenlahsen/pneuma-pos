<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class BrandApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $baseUrl = '/api/brands';

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', function () {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            })->name('login');
        }

        $this->ensureTestTablesExist();
        $this->ensureProductsTableExists();

        foreach ([
            'view brands',
            'create brands',
            'edit brands',
            'delete brands',
        ] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        Storage::fake('public');
    }

    protected function ensureTestTablesExist()
    {
        $this->ensureUsersTableExists();
        $this->ensureBrandsTableExists();
        $this->ensurePermissionTablesExist();
    }

    protected function ensureUsersTableExists()
    {
        if (! Schema::hasTable('users')) {
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
    }

    protected function ensureBrandsTableExists()
    {
        if (! Schema::hasTable('brands')) {
            Schema::create('brands', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('logo')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
    }

    protected function ensureProductsTableExists()
    {
        if (! Schema::hasTable('products')) {
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
    }

    protected function ensurePermissionTablesExist()
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
                $table->index(['model_id', 'model_type'], 'model_has_permissions_model_id_model_type_index');
                $table->foreign('permission_id')
                    ->references('id')
                    ->on('permissions')
                    ->onDelete('cascade');
                $table->primary(['permission_id', 'model_id', 'model_type'], 'model_has_permissions_permission_model_type_primary');
            });
        }

        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type'], 'model_has_roles_model_id_model_type_index');
                $table->foreign('role_id')
                    ->references('id')
                    ->on('roles')
                    ->onDelete('cascade');
                $table->primary(['role_id', 'model_id', 'model_type'], 'model_has_roles_role_model_type_primary');
            });
        }

        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->unsignedBigInteger('role_id');
                $table->foreign('permission_id')
                    ->references('id')
                    ->on('permissions')
                    ->onDelete('cascade');
                $table->foreign('role_id')
                    ->references('id')
                    ->on('roles')
                    ->onDelete('cascade');
                $table->primary(['permission_id', 'role_id'], 'role_has_permissions_permission_id_role_id_primary');
            });
        }
    }

    protected function authenticateWithPermissions($permissions = [])
    {
        $user = User::query()->create([
            'name' => 'Test User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        Sanctum::actingAs($user, [], 'web');

        return $user;
    }

    protected function createBrand($attributes = [])
    {
        return Brand::query()->create(array_merge([
            'name' => 'Brand '.fake()->unique()->company(),
            'logo' => null,
            'is_active' => true,
        ], $attributes));
    }

    public function test_index_requires_authentication()
    {
        $response = $this->getJson($this->baseUrl);

        $response->assertUnauthorized();
    }

    public function test_index_forbids_user_without_view_permission()
    {
        $this->authenticateWithPermissions();

        $response = $this->getJson($this->baseUrl);

        $response->assertForbidden();
    }

    public function test_index_returns_paginated_brand_collection()
    {
        $this->authenticateWithPermissions(['view brands']);

        $this->createBrand([
            'name' => 'Zeta',
            'is_active' => true,
        ]);

        $this->createBrand([
            'name' => 'Alpha',
            'is_active' => false,
        ]);

        $response = $this->getJson($this->baseUrl.'?per_page=1&sort_by=name&sort_direction=asc');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data' => [
                    [
                        'id',
                        'name',
                        'logo',
                        'logo_url',
                        'is_active',
                        'created_at',
                        'updated_at',
                    ],
                ],
                'first_page_url',
                'from',
                'last_page',
                'last_page_url',
                'links',
                'next_page_url',
                'path',
                'per_page',
                'prev_page_url',
                'to',
                'total',
            ])
            ->assertJsonPath('per_page', 1)
            ->assertJsonPath('total', 2)
            ->assertJsonPath('data.0.name', 'Alpha');
    }

    public function test_index_can_filter_brands()
    {
        $this->authenticateWithPermissions(['view brands']);

        $this->createBrand([
            'name' => 'Acme',
            'is_active' => true,
        ]);

        $this->createBrand([
            'name' => 'Beta',
            'is_active' => false,
        ]);

        $response = $this->getJson($this->baseUrl.'?search=acm&is_active=1');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Acme');
    }

    public function test_store_creates_brand_with_permission()
    {
        $this->authenticateWithPermissions(['create brands']);

        $response = $this->postJson($this->baseUrl, [
            'name' => 'New Brand',
            'is_active' => true,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('name', 'New Brand')
            ->assertJsonPath('is_active', true);

        $this->assertDatabaseHas('brands', [
            'name' => 'New Brand',
            'is_active' => true,
        ]);
    }

    public function test_store_forbids_user_without_create_permission()
    {
        $this->authenticateWithPermissions();

        $response = $this->postJson($this->baseUrl, [
            'name' => 'Blocked Brand',
            'is_active' => true,
        ]);

        $response->assertForbidden();
    }

    public function test_store_can_upload_logo()
    {
        $this->authenticateWithPermissions(['create brands']);

        $file = UploadedFile::fake()->image('logo.png');

        $response = $this->post($this->baseUrl, [
            'name' => 'Logo Brand',
            'is_active' => 1,
            'logo' => $file,
        ]);

        $response->assertCreated();

        $brand = Brand::query()->where('name', 'Logo Brand')->firstOrFail();

        $this->assertNotNull($brand->logo);
        Storage::disk('public')->assertExists($brand->logo);
    }

    public function test_show_returns_brand_when_user_has_view_permission()
    {
        $brand = $this->createBrand([
            'name' => 'Shown Brand',
            'is_active' => true,
        ]);

        $this->authenticateWithPermissions(['view brands']);

        $response = $this->getJson($this->baseUrl.'/'.$brand->id);

        $response
            ->assertOk()
            ->assertJsonPath('id', $brand->id)
            ->assertJsonPath('name', 'Shown Brand');
    }

    public function test_update_modifies_brand_with_permission()
    {
        $brand = $this->createBrand([
            'name' => 'Old Brand',
            'is_active' => true,
        ]);

        $this->authenticateWithPermissions(['edit brands']);

        $response = $this->putJson($this->baseUrl.'/'.$brand->id, [
            'name' => 'Updated Brand',
            'is_active' => false,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('name', 'Updated Brand')
            ->assertJsonPath('is_active', false);

        $this->assertDatabaseHas('brands', [
            'id' => $brand->id,
            'name' => 'Updated Brand',
            'is_active' => false,
        ]);
    }

    public function test_update_replaces_existing_logo()
    {
        $this->authenticateWithPermissions(['edit brands']);

        $oldLogo = UploadedFile::fake()->image('old-logo.png')->store('brands', 'public');

        $brand = $this->createBrand([
            'name' => 'Brand With Logo',
            'logo' => $oldLogo,
            'is_active' => true,
        ]);

        $newLogo = UploadedFile::fake()->image('new-logo.png');

        $response = $this->post($this->baseUrl.'/'.$brand->id, [
            '_method' => 'PUT',
            'name' => 'Brand With New Logo',
            'is_active' => 1,
            'logo' => $newLogo,
        ]);

        $response->assertOk();

        $brand->refresh();

        Storage::disk('public')->assertMissing($oldLogo);
        Storage::disk('public')->assertExists($brand->logo);
        $this->assertSame('Brand With New Logo', $brand->name);
    }

    public function test_delete_removes_brand_with_permission()
    {
        $brand = $this->createBrand([
            'name' => 'Disposable Brand',
            'is_active' => true,
        ]);

        $this->authenticateWithPermissions(['delete brands']);

        $response = $this->deleteJson($this->baseUrl.'/'.$brand->id);

        $response->assertNoContent();

        $this->assertDatabaseMissing('brands', [
            'id' => $brand->id,
        ]);
    }

    public function test_delete_forbids_user_without_delete_permission()
    {
        $brand = $this->createBrand([
            'name' => 'Protected Brand',
            'is_active' => true,
        ]);

        $this->authenticateWithPermissions();

        $response = $this->deleteJson($this->baseUrl.'/'.$brand->id);

        $response->assertForbidden();
    }

    public function test_delete_returns_validation_error_when_brand_is_used_by_products()
    {
        $this->ensureProductsTableExists();
        $this->authenticateWithPermissions(['delete brands']);

        $brand = $this->createBrand([
            'name' => 'Used Brand',
            'is_active' => true,
        ]);

        DB::table('products')->insert([
            'brand_id' => $brand->id,
            'profile' => '205/55R16',
            'reference' => 'REF-USED-BRAND',
            'type' => 'part',
            'description' => 'Linked product',
            'unit' => 'pcs',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->deleteJson($this->baseUrl.'/'.$brand->id);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['brand']);

        $this->assertDatabaseHas('brands', [
            'id' => $brand->id,
        ]);
    }
}