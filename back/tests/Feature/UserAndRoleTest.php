<?php

namespace Tests\Feature;

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

class UserAndRoleTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Role $adminRole;
    private Role $commercialRole;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view users', 'create users', 'edit users', 'delete users',
            'view roles', 'create roles', 'edit roles', 'delete roles',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $this->adminRole = Role::findOrCreate('Administrator', 'web');
        $this->adminRole->syncPermissions(Permission::query()->get());

        $this->commercialRole = Role::findOrCreate('Commercial', 'web');

        $this->admin = User::query()->create([
            'name' => 'Admin User',
            'email' => fake()->unique()->safeEmail(),
            'password' => bcrypt('password'),
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->admin->assignRole($this->adminRole);
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
    }

    // =========================================================================
    // USERS
    // =========================================================================

    // GET /api/users

    public function test_users_index_requires_authentication(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
    }

    public function test_users_index_requires_permission(): void
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
        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_users_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/users');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total', 'current_page', 'per_page']);

        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_users_index_filters_by_search(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/users?search=Admin');
        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    // POST /api/users

    public function test_users_store_requires_permission(): void
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

        $this->postJson('/api/users', ['name' => 'x'])->assertForbidden();
    }

    public function test_users_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/users', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_users_store_validates_unique_email(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/users', [
            'name' => 'Duplicate',
            'email' => $this->admin->email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_users_store_creates_user_with_role(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $email = fake()->unique()->safeEmail();

        $response = $this->postJson('/api/users', [
            'name' => 'New Commercial',
            'email' => $email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'phone' => '0699999999',
            'commission_rate' => 5,
            'role' => 'Commercial',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'New Commercial');

        $this->assertDatabaseHas('users', ['email' => $email]);

        $newUser = User::where('email', $email)->first();
        $this->assertTrue($newUser->hasRole('Commercial'));
    }

    public function test_users_store_prevents_non_admin_from_assigning_admin_role(): void
    {
        $manager = User::query()->create([
            'name' => 'Manager',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0611111111',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $manager->assignRole($this->commercialRole);
        Permission::findOrCreate('create users', 'web');
        $manager->givePermissionTo('create users');

        Sanctum::actingAs($manager, [], 'web');

        $this->postJson('/api/users', [
            'name' => 'New Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'Administrator',
        ])->assertForbidden();
    }

    // GET /api/users/{user}

    public function test_users_show_returns_user(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson("/api/users/{$this->admin->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->admin->id)
            ->assertJsonPath('name', 'Admin User');
    }

    // PUT /api/users/{user}

    public function test_users_update_modifies_user(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $target = User::query()->create([
            'name' => 'Original Name',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0622222222',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $target->assignRole($this->commercialRole);

        $response = $this->putJson("/api/users/{$target->id}", [
            'name' => 'Updated Name',
            'email' => $target->email,
            'commission_rate' => 10,
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Updated Name');
    }

    public function test_users_update_prevents_removing_last_admin(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->putJson("/api/users/{$this->admin->id}", [
            'name' => $this->admin->name,
            'email' => $this->admin->email,
            'role' => 'Commercial',
        ]);

        $response->assertUnprocessable();
    }

    // DELETE /api/users/{user}

    public function test_users_destroy_requires_permission(): void
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
        $this->deleteJson("/api/users/{$this->admin->id}")->assertForbidden();
    }

    public function test_users_destroy_prevents_self_deletion(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->deleteJson("/api/users/{$this->admin->id}")
            ->assertUnprocessable();
    }

    public function test_users_destroy_prevents_deleting_last_admin(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->deleteJson("/api/users/{$this->admin->id}")
            ->assertUnprocessable();
    }

    public function test_users_destroy_deletes_non_admin_user(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $target = User::query()->create([
            'name' => 'To Delete',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0633333333',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $target->assignRole($this->commercialRole);

        $this->deleteJson("/api/users/{$target->id}")->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    // =========================================================================
    // ROLES
    // =========================================================================

    // GET /api/roles

    public function test_roles_index_requires_authentication(): void
    {
        $this->getJson('/api/roles')->assertUnauthorized();
    }

    public function test_roles_index_requires_permission(): void
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
        $this->getJson('/api/roles')->assertForbidden();
    }

    public function test_roles_index_returns_paginated_list_with_permissions(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/roles');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total']);

        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    // POST /api/roles

    public function test_roles_store_creates_role(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->postJson('/api/roles', [
            'name' => 'NewCustomRole',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'NewCustomRole');

        $this->assertDatabaseHas('roles', ['name' => 'NewCustomRole']);
    }

    public function test_roles_store_validates_unique_name(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/roles', [
            'name' => 'Administrator',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_roles_store_with_permissions(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $viewPerm = Permission::findOrCreate('view users', 'web');

        $response = $this->postJson('/api/roles', [
            'name' => 'RoleWithPerms',
            'permissions' => [$viewPerm->id],
        ]);

        $response->assertCreated();

        $role = Role::where('name', 'RoleWithPerms')->first();
        $this->assertTrue($role->hasPermissionTo('view users'));
    }

    // GET /api/roles/{role}

    public function test_roles_show_returns_role_with_permissions(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson("/api/roles/{$this->adminRole->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->adminRole->id)
            ->assertJsonPath('name', 'Administrator')
            ->assertJsonStructure(['id', 'name', 'permissions']);
    }

    // PUT /api/roles/{role}

    public function test_roles_update_modifies_role(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $customRole = Role::findOrCreate('CustomRole', 'web');

        $response = $this->putJson("/api/roles/{$customRole->id}", [
            'name' => 'RenamedRole',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'RenamedRole');
    }

    public function test_roles_update_prevents_renaming_administrator(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->putJson("/api/roles/{$this->adminRole->id}", [
            'name' => 'SuperAdmin',
        ])->assertUnprocessable();
    }

    // PUT /api/roles/{role}/permissions

    public function test_roles_assign_permissions_updates_role(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $customRole = Role::findOrCreate('RoleForAssign', 'web');
        $perm = Permission::findOrCreate('view users', 'web');

        $response = $this->putJson("/api/roles/{$customRole->id}/permissions", [
            'permissions' => [$perm->id],
        ]);

        $response->assertOk();
        $this->assertTrue($customRole->fresh()->hasPermissionTo('view users'));
    }

    // DELETE /api/roles/{role}

    public function test_roles_destroy_deletes_unused_role(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $role = Role::findOrCreate('RoleToDelete', 'web');

        $this->deleteJson("/api/roles/{$role->id}")->assertNoContent();

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
    }

    public function test_roles_destroy_prevents_deleting_administrator(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->deleteJson("/api/roles/{$this->adminRole->id}")
            ->assertUnprocessable();
    }

    public function test_roles_destroy_prevents_deleting_role_with_users(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $roleInUse = Role::findOrCreate('RoleInUse', 'web');
        $userWithRole = User::query()->create([
            'name' => 'Has Role',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0644444444',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $userWithRole->assignRole($roleInUse);

        $this->deleteJson("/api/roles/{$roleInUse->id}")
            ->assertUnprocessable();
    }
}
