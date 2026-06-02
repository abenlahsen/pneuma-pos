<?php

namespace Tests\Feature;

use App\Models\Carrier;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CarrierApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $baseUrl = '/api/carriers';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureTestTablesExist();

        foreach (['view carriers', 'create carriers', 'edit carriers', 'delete carriers'] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
    }

    protected function ensureTestTablesExist()
    {
        $this->ensureUsersTableExists();
        $this->ensureCarriersTableExists();
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

    protected function ensureCarriersTableExists()
    {
        if (! Schema::hasTable('carriers')) {
            Schema::create('carriers', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
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

    protected function carrierPayload($overrides = [])
    {
        return array_merge([
            'name' => 'Carrier Alpha',
            'phone' => '0612345678',
            'email' => 'carrier.alpha@example.com',
        ], $overrides);
    }

    protected function createCarrier($attributes = [])
    {
        if (! array_key_exists('user_id', $attributes)) {
            $attributes['user_id'] = User::query()->create([
                'name' => 'Carrier Creator',
                'email' => fake()->unique()->safeEmail(),
                'password' => 'password',
                'phone' => '0600000002',
                'commission_rate' => 0,
                'must_change_password' => false,
            ])->id;
        }

        return Carrier::query()->create(array_merge($this->carrierPayload(), $attributes));
    }

    public function test_carriers_endpoints_require_authentication()
    {
        $carrier = $this->createCarrier(['email' => 'auth-check@example.com']);

        $this->getJson($this->baseUrl)->assertUnauthorized();
        $this->getJson($this->baseUrl.'/'.$carrier->id)->assertUnauthorized();
        $this->postJson($this->baseUrl, $this->carrierPayload(['email' => 'create-auth@example.com']))->assertUnauthorized();
        $this->putJson($this->baseUrl.'/'.$carrier->id, $this->carrierPayload(['name' => 'Updated Carrier']))->assertUnauthorized();
        $this->deleteJson($this->baseUrl.'/'.$carrier->id)->assertUnauthorized();
    }

    public function test_index_requires_view_carriers_permission()
    {
        $this->createCarrier(['email' => 'view-required@example.com']);
        $this->authenticateWithPermissions();

        $this->getJson($this->baseUrl)->assertForbidden();
    }

    public function test_index_returns_paginated_carriers_structure()
    {
        $this->authenticateWithPermissions(['view carriers']);

        $this->createCarrier(['name' => 'First Carrier', 'email' => 'first@example.com']);
        $this->createCarrier(['name' => 'Second Carrier', 'email' => 'second@example.com']);
        $this->createCarrier(['name' => 'Third Carrier', 'email' => 'third@example.com']);

        $response = $this->getJson($this->baseUrl.'?per_page=2');

        $response->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data' => [
                    '*' => ['id', 'name', 'phone', 'email', 'user_id', 'created_at', 'updated_at'],
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

    public function test_store_requires_create_carriers_permission()
    {
        $this->authenticateWithPermissions();

        $this->postJson($this->baseUrl, $this->carrierPayload(['email' => 'store-forbidden@example.com']))
            ->assertForbidden();
    }

    public function test_store_creates_carrier_and_sets_authenticated_user()
    {
        $user = $this->authenticateWithPermissions(['create carriers']);

        $payload = $this->carrierPayload(['email' => 'created@example.com']);

        $response = $this->postJson($this->baseUrl, $payload);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => $payload['name'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'user_id' => $user->id,
            ]);

        $this->assertDatabaseHas('carriers', [
            'name' => $payload['name'],
            'email' => $payload['email'],
            'user_id' => $user->id,
        ]);
    }

    public function test_show_requires_view_carriers_permission()
    {
        $carrier = $this->createCarrier(['email' => 'show-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->getJson($this->baseUrl.'/'.$carrier->id)->assertForbidden();
    }

    public function test_show_returns_carrier_details()
    {
        $this->authenticateWithPermissions(['view carriers']);

        $carrier = $this->createCarrier(['name' => 'Visible Carrier', 'email' => 'visible@example.com']);

        $this->getJson($this->baseUrl.'/'.$carrier->id)
            ->assertOk()
            ->assertJsonFragment([
                'id' => $carrier->id,
                'name' => 'Visible Carrier',
                'email' => 'visible@example.com',
            ]);
    }

    public function test_update_requires_edit_carriers_permission()
    {
        $carrier = $this->createCarrier(['email' => 'update-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->putJson($this->baseUrl.'/'.$carrier->id, $this->carrierPayload([
            'name' => 'Blocked Update',
            'email' => 'blocked.update@example.com',
        ]))->assertForbidden();
    }

    public function test_update_modifies_carrier()
    {
        $this->authenticateWithPermissions(['edit carriers']);

        $carrier = $this->createCarrier(['email' => 'before-update@example.com']);

        $payload = $this->carrierPayload([
            'name' => 'Updated Carrier',
            'phone' => '0698765432',
            'email' => 'after-update@example.com',
        ]);

        $this->putJson($this->baseUrl.'/'.$carrier->id, $payload)
            ->assertOk()
            ->assertJsonFragment([
                'id' => $carrier->id,
                'name' => 'Updated Carrier',
                'phone' => '0698765432',
                'email' => 'after-update@example.com',
            ]);

        $this->assertDatabaseHas('carriers', [
            'id' => $carrier->id,
            'name' => 'Updated Carrier',
            'email' => 'after-update@example.com',
        ]);
    }

    public function test_delete_requires_delete_carriers_permission()
    {
        $carrier = $this->createCarrier(['email' => 'delete-forbidden@example.com']);
        $this->authenticateWithPermissions();

        $this->deleteJson($this->baseUrl.'/'.$carrier->id)->assertForbidden();
    }

    public function test_delete_removes_carrier()
    {
        $this->authenticateWithPermissions(['delete carriers']);

        $carrier = $this->createCarrier(['email' => 'delete-me@example.com']);

        $this->deleteJson($this->baseUrl.'/'.$carrier->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('carriers', [
            'id' => $carrier->id,
        ]);
    }
}