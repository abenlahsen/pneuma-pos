<?php

namespace Tests\Feature;

use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SupplierApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $baseUrl = '/api/suppliers';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureTestTablesExist();

        foreach ([
            'view suppliers',
            'create suppliers',
            'edit suppliers',
            'delete suppliers',
        ] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
    }

    protected function ensureTestTablesExist()
    {
        $this->ensureUsersTableExists();
        $this->ensureSuppliersTableExists();
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

    protected function ensureSuppliersTableExists()
    {
        if (! Schema::hasTable('suppliers')) {
            Schema::create('suppliers', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('contact_person')->nullable();
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->text('address')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
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

    protected function createSupplier($attributes = [])
    {
        if (! array_key_exists('user_id', $attributes)) {
            $attributes['user_id'] = User::query()->create([
                'name' => 'Supplier Creator',
                'email' => fake()->unique()->safeEmail(),
                'password' => 'password',
                'phone' => '0600000001',
                'commission_rate' => 0,
                'must_change_password' => false,
            ])->id;
        }

        return Supplier::query()->create(array_merge([
            'name' => 'Supplier '.fake()->unique()->company(),
            'contact_person' => 'John Doe',
            'phone' => '0612345678',
            'email' => fake()->unique()->safeEmail(),
            'address' => '123 Supplier Street',
        ], $attributes));
    }

    protected function supplierPayload($overrides = [])
    {
        return array_merge([
            'name' => 'Supplier Alpha',
            'contact_person' => 'John Doe',
            'phone' => '0612345678',
            'email' => 'supplier.alpha@example.com',
            'address' => '123 Supplier Street',
        ], $overrides);
    }

    public function test_suppliers_endpoints_require_authentication()
    {
        $supplier = $this->createSupplier(['email' => 'auth-check@example.com']);

        $this->getJson($this->baseUrl)->assertUnauthorized();
        $this->getJson($this->baseUrl.'/'.$supplier->id)->assertUnauthorized();
        $this->postJson($this->baseUrl, $this->supplierPayload(['email' => 'create-auth@example.com']))->assertUnauthorized();
        $this->putJson($this->baseUrl.'/'.$supplier->id, $this->supplierPayload(['name' => 'Updated', 'email' => 'updated-auth@example.com']))->assertUnauthorized();
        $this->deleteJson($this->baseUrl.'/'.$supplier->id)->assertUnauthorized();
    }

    public function test_index_requires_view_suppliers_permission()
    {
        $this->createSupplier(['email' => 'view-required@example.com']);
        $this->authenticateWithPermissions();

        $this->getJson($this->baseUrl)->assertForbidden();
    }

    public function test_index_returns_paginated_suppliers_structure()
    {
        $this->authenticateWithPermissions(['view suppliers']);

        $this->createSupplier([
            'name' => 'First Supplier',
            'email' => 'first@example.com',
        ]);
        $this->createSupplier([
            'name' => 'Second Supplier',
            'email' => 'second@example.com',
        ]);
        $this->createSupplier([
            'name' => 'Third Supplier',
            'email' => 'third@example.com',
        ]);

        $response = $this->getJson($this->baseUrl.'?per_page=2');

        $response->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data' => [
                    '*' => ['id', 'name', 'contact_person', 'phone', 'email', 'address', 'user_id', 'created_at', 'updated_at'],
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
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('total', 3);
    }

    public function test_store_requires_create_suppliers_permission()
    {
        $this->authenticateWithPermissions();

        $this->postJson($this->baseUrl, $this->supplierPayload(['email' => 'store-forbidden@example.com']))
            ->assertForbidden();
    }

    public function test_store_creates_supplier_and_sets_authenticated_user()
    {
        $user = $this->authenticateWithPermissions(['create suppliers']);

        $payload = $this->supplierPayload(['email' => 'created@example.com']);

        $response = $this->postJson($this->baseUrl, $payload);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => $payload['name'],
                'contact_person' => $payload['contact_person'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'address' => $payload['address'],
                'user_id' => $user->id,
            ]);

        $this->assertDatabaseHas('suppliers', [
            'name' => $payload['name'],
            'email' => $payload['email'],
            'user_id' => $user->id,
        ]);
    }

    public function test_show_requires_view_suppliers_permission()
    {
        $supplier = $this->createSupplier(['email' => 'show-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->getJson($this->baseUrl.'/'.$supplier->id)->assertForbidden();
    }

    public function test_show_returns_supplier_details()
    {
        $this->authenticateWithPermissions(['view suppliers']);

        $supplier = $this->createSupplier([
            'name' => 'Visible Supplier',
            'email' => 'visible@example.com',
        ]);

        $this->getJson($this->baseUrl.'/'.$supplier->id)
            ->assertOk()
            ->assertJsonFragment([
                'id' => $supplier->id,
                'name' => 'Visible Supplier',
                'email' => 'visible@example.com',
            ]);
    }

    public function test_update_requires_edit_suppliers_permission()
    {
        $supplier = $this->createSupplier(['email' => 'update-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->putJson($this->baseUrl.'/'.$supplier->id, $this->supplierPayload([
            'name' => 'Blocked Update',
            'email' => 'blocked.update@example.com',
        ]))->assertForbidden();
    }

    public function test_update_modifies_supplier()
    {
        $this->authenticateWithPermissions(['edit suppliers']);

        $supplier = $this->createSupplier(['email' => 'before-update@example.com']);

        $payload = $this->supplierPayload([
            'name' => 'Updated Supplier',
            'contact_person' => 'Jane Doe',
            'phone' => '0698765432',
            'email' => 'after-update@example.com',
            'address' => '456 Updated Avenue',
        ]);

        $this->putJson($this->baseUrl.'/'.$supplier->id, $payload)
            ->assertOk()
            ->assertJsonFragment([
                'id' => $supplier->id,
                'name' => 'Updated Supplier',
                'contact_person' => 'Jane Doe',
                'phone' => '0698765432',
                'email' => 'after-update@example.com',
                'address' => '456 Updated Avenue',
            ]);

        $this->assertDatabaseHas('suppliers', [
            'id' => $supplier->id,
            'name' => 'Updated Supplier',
            'email' => 'after-update@example.com',
        ]);
    }

    public function test_delete_requires_delete_suppliers_permission()
    {
        $supplier = $this->createSupplier(['email' => 'delete-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->deleteJson($this->baseUrl.'/'.$supplier->id)->assertForbidden();
    }

    public function test_delete_removes_supplier()
    {
        $this->authenticateWithPermissions(['delete suppliers']);

        $supplier = $this->createSupplier(['email' => 'delete-me@example.com']);

        $this->deleteJson($this->baseUrl.'/'.$supplier->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('suppliers', [
            'id' => $supplier->id,
        ]);
    }
}