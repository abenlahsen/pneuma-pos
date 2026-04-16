<?php

namespace Tests\Feature;

use App\Models\Partner;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PartnerApiTest extends TestCase
{
    use DatabaseTransactions;

    protected $baseUrl = '/api/partners';

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureTestTablesExist();

        foreach (['view partners', 'create partners', 'edit partners', 'delete partners'] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
    }

    protected function ensureTestTablesExist()
    {
        $this->ensureUsersTableExists();
        $this->ensurePartnersTableExists();
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

    protected function ensurePartnersTableExists()
    {
        if (! Schema::hasTable('partners')) {
            Schema::create('partners', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('city')->nullable();
                $table->string('phone')->nullable();
                $table->string('mobile')->nullable();
                $table->string('address')->nullable();
                $table->decimal('montage_price', 10, 2)->nullable();
                $table->decimal('alignment_price', 10, 2)->nullable();
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

    protected function createPartner($attributes = [])
    {
        $user = User::query()->create([
            'name' => 'Owner '.fake()->unique()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0611111111',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        return Partner::query()->create(array_merge([
            'name' => 'Partner '.fake()->unique()->company(),
            'city' => 'Casablanca',
            'phone' => '0522000000',
            'mobile' => '0612345678',
            'address' => 'Rue Test',
            'montage_price' => 120.50,
            'alignment_price' => 80.25,
            'user_id' => $user->id,
        ], $attributes));
    }

    public function test_index_requires_authentication()
    {
        $response = $this->getJson($this->baseUrl);

        $response->assertUnauthorized();
    }

    public function test_index_requires_view_permission()
    {
        $this->authenticateWithPermissions();

        $response = $this->getJson($this->baseUrl);

        $response->assertForbidden();
    }

    public function test_index_returns_paginated_partners_structure()
    {
        $this->authenticateWithPermissions(['view partners']);

        $first = $this->createPartner([
            'name' => 'Alpha Partner',
            'city' => 'Rabat',
            'phone' => '0500000001',
            'mobile' => '0600000001',
        ]);

        $this->createPartner([
            'name' => 'Beta Partner',
            'city' => 'Marrakesh',
            'phone' => '0500000002',
            'mobile' => '0600000002',
        ]);

        $response = $this->getJson($this->baseUrl.'?per_page=1&sort_by=name&sort_direction=asc');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'current_page',
                'data' => [[
                    'id',
                    'name',
                    'city',
                    'phone',
                    'mobile',
                    'address',
                    'montage_price',
                    'alignment_price',
                    'user_id',
                    'created_at',
                    'updated_at',
                ]],
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
            ->assertJsonPath('current_page', 1)
            ->assertJsonPath('per_page', 1)
            ->assertJsonPath('total', 2)
            ->assertJsonPath('last_page', 2)
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.0.name', 'Alpha Partner');
    }

    public function test_create_requires_create_permission()
    {
        $this->authenticateWithPermissions();

        $response = $this->postJson($this->baseUrl, $this->partnerPayload());

        $response->assertForbidden();
    }

    public function test_create_partner_returns_created_resource()
    {
        $user = $this->authenticateWithPermissions(['create partners']);

        $payload = $this->partnerPayload();

        $response = $this->postJson($this->baseUrl, $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('name', $payload['name'])
            ->assertJsonPath('city', $payload['city'])
            ->assertJsonPath('phone', $payload['phone'])
            ->assertJsonPath('mobile', $payload['mobile'])
            ->assertJsonPath('address', $payload['address'])
            ->assertJsonPath('montage_price', number_format((float) $payload['montage_price'], 2, '.', ''))
            ->assertJsonPath('alignment_price', number_format((float) $payload['alignment_price'], 2, '.', ''))
            ->assertJsonPath('user_id', $user->id);

        $this->assertDatabaseHas('partners', [
            'name' => $payload['name'],
            'city' => $payload['city'],
            'phone' => $payload['phone'],
            'mobile' => $payload['mobile'],
            'address' => $payload['address'],
            'user_id' => $user->id,
        ]);
    }

    public function test_show_requires_view_permission()
    {
        $partner = $this->createPartner();

        $this->authenticateWithPermissions();

        $response = $this->getJson($this->baseUrl.'/'.$partner->id);

        $response->assertForbidden();
    }

    public function test_show_returns_partner_resource()
    {
        $partner = $this->createPartner([
            'name' => 'Shown Partner',
            'city' => 'Fes',
        ]);

        $this->authenticateWithPermissions(['view partners']);

        $response = $this->getJson($this->baseUrl.'/'.$partner->id);

        $response
            ->assertOk()
            ->assertJsonPath('id', $partner->id)
            ->assertJsonPath('name', 'Shown Partner')
            ->assertJsonPath('city', 'Fes')
            ->assertJsonStructure([
                'id',
                'name',
                'city',
                'phone',
                'mobile',
                'address',
                'montage_price',
                'alignment_price',
                'user_id',
                'created_at',
                'updated_at',
            ]);
    }

    public function test_update_requires_edit_permission()
    {
        $partner = $this->createPartner();

        $this->authenticateWithPermissions();

        $response = $this->putJson($this->baseUrl.'/'.$partner->id, [
            'name' => 'Updated Partner',
            'city' => 'Agadir',
            'phone' => '0500000099',
            'mobile' => '0600000099',
            'address' => 'Updated Address',
            'montage_price' => 200,
            'alignment_price' => 100,
        ]);

        $response->assertForbidden();
    }

    public function test_update_partner_returns_updated_resource()
    {
        $partner = $this->createPartner();

        $this->authenticateWithPermissions(['edit partners']);

        $payload = [
            'name' => 'Updated Partner',
            'city' => 'Agadir',
            'phone' => '0500000099',
            'mobile' => '0600000099',
            'address' => 'Updated Address',
            'montage_price' => 200,
            'alignment_price' => 100,
        ];

        $response = $this->putJson($this->baseUrl.'/'.$partner->id, $payload);

        $response
            ->assertOk()
            ->assertJsonPath('id', $partner->id)
            ->assertJsonPath('name', $payload['name'])
            ->assertJsonPath('city', $payload['city'])
            ->assertJsonPath('phone', $payload['phone'])
            ->assertJsonPath('mobile', $payload['mobile'])
            ->assertJsonPath('address', $payload['address'])
            ->assertJsonPath('montage_price', number_format((float) $payload['montage_price'], 2, '.', ''))
            ->assertJsonPath('alignment_price', number_format((float) $payload['alignment_price'], 2, '.', ''));

        $this->assertDatabaseHas('partners', [
            'id' => $partner->id,
            'name' => $payload['name'],
            'city' => $payload['city'],
            'phone' => $payload['phone'],
            'mobile' => $payload['mobile'],
            'address' => $payload['address'],
        ]);
    }

    public function test_delete_requires_delete_permission()
    {
        $partner = $this->createPartner();

        $this->authenticateWithPermissions();

        $response = $this->deleteJson($this->baseUrl.'/'.$partner->id);

        $response->assertForbidden();
    }

    public function test_delete_partner_returns_no_content()
    {
        $partner = $this->createPartner();

        $this->authenticateWithPermissions(['delete partners']);

        $response = $this->deleteJson($this->baseUrl.'/'.$partner->id);

        $response->assertNoContent();

        $this->assertDatabaseMissing('partners', [
            'id' => $partner->id,
        ]);
    }

    protected function partnerPayload()
    {
        return [
            'name' => 'New Partner',
            'city' => 'Tangier',
            'phone' => '0522999999',
            'mobile' => '0612999999',
            'address' => '123 Test Avenue',
            'montage_price' => 150.75,
            'alignment_price' => 90.50,
        ];
    }
}