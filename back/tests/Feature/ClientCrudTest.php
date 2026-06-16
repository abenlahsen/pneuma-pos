<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\Client;
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

class ClientCrudTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();
        $this->ensureCitiesTable();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view clients', 'create clients', 'edit clients', 'delete clients'] as $perm) {
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

        City::firstOrCreate(['name' => 'Casablanca']);

        $this->client = Client::query()->create([
            'name' => 'Ahmed Benali',
            'category' => 'Paticulier',
            'phone' => '0612345678',
            'email' => 'ahmed@example.com',
            'city' => 'Casablanca',
            'is_active' => true,
            'opening_balance' => 0,
            'credit_limit' => 1000,
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function ensureCitiesTable(): void
    {
        if (! Schema::hasTable('cities')) {
            Schema::create('cities', function (Blueprint $t) {
                $t->id();
                $t->string('name')->unique();
            });
        }
    }

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

        if (! Schema::hasTable('clients')) {
            Schema::create('clients', function (Blueprint $t) {
                $t->id();
                $t->string('name');
                $t->string('category')->nullable();
                $t->string('phone')->nullable();
                $t->string('email')->nullable();
                $t->unsignedBigInteger('city_id')->nullable();
                $t->text('address')->nullable();
                $t->text('notes')->nullable();
                $t->boolean('is_active')->default(true);
                $t->decimal('credit_limit', 12, 2)->nullable()->default(0);
                $t->decimal('opening_balance', 12, 2)->nullable()->default(0);
                $t->unsignedInteger('payment_terms_days')->nullable();
                $t->string('default_payment_method')->nullable();
                $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $t->timestamps();
            });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/clients
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/clients')->assertUnauthorized();
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

        $this->getJson('/api/clients')->assertForbidden();
    }

    public function test_index_returns_paginated_clients(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients');

        $response->assertOk()
            ->assertJsonStructure(['data', 'meta']);

        $this->assertGreaterThanOrEqual(1, count($response->json('data')));
    }

    public function test_index_filters_by_search(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients?search=Ahmed');

        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertStringContainsStringIgnoringCase('Ahmed', $item['name'].($item['phone'] ?? '').($item['email'] ?? '').($item['city'] ?? ''));
        }
    }

    public function test_index_filters_by_city(): void
    {
        City::firstOrCreate(['name' => 'Rabat']);

        Client::query()->create([
            'name' => 'Client Rabat',
            'category' => 'Entreprise',
            'phone' => '0699999999',
            'city' => 'Rabat',
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients?city=Casablanca');
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertEquals('Casablanca', $item['city']);
        }
    }

    public function test_index_filters_by_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients?category=Paticulier');
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertEquals('Paticulier', $item['category']);
        }
    }

    public function test_index_filters_by_active_status(): void
    {
        Client::query()->create([
            'name' => 'Client Inactif',
            'category' => 'Paticulier',
            'phone' => '0688888888',
            'is_active' => false,
        ]);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients?is_active=1');
        $response->assertOk();

        foreach ($response->json('data') as $item) {
            $this->assertTrue($item['is_active']);
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/clients
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/clients', [])->assertUnauthorized();
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

        $this->postJson('/api/clients', ['name' => 'Test', 'category' => 'Paticulier'])->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/clients', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_validates_category_values(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/clients', [
            'name' => 'Test Client',
            'category' => 'InvalidType',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['category']);
    }

    public function test_store_without_category_succeeds_and_uses_db_default(): void
    {
        // Regression: StoreClientRequest had no 'category' rule → NULL was sent to DB
        // → SQLSTATE[23000] NOT NULL constraint violation on 'category' column.
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/clients', [
            'name' => 'Client Sans Catégorie',
            'phone' => '0655555555',
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('clients', [
            'name' => 'Client Sans Catégorie',
            'phone' => '0655555555',
        ]);
    }

    public function test_store_accepts_particulier_with_correct_spelling(): void
    {
        // Regression: Rule::in had 'Paticulier' (typo). After frontend fix the correct
        // spelling 'Particulier' was rejected by validation (422).
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/clients', [
            'name' => 'Client Particulier',
            'phone' => '0644444444',
            'category' => 'Particulier',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.category', 'Particulier');
    }

    public function test_store_accepts_entreprise_category(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/clients', [
            'name' => 'Client Entreprise',
            'phone' => '0633333333',
            'category' => 'Entreprise',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.category', 'Entreprise');
    }

    public function test_store_validates_unique_phone(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/clients', [
            'name' => 'Duplicate Phone',
            'category' => 'Paticulier',
            'phone' => '0612345678', // same as $this->client
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_store_creates_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        City::firstOrCreate(['name' => 'Marrakech']);

        $response = $this->postJson('/api/clients', [
            'name' => 'Nouveau Client',
            'category' => 'Entreprise',
            'phone' => '0677777777',
            'city' => 'Marrakech',
            'credit_limit' => 2000,
            'opening_balance' => 500,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Nouveau Client')
            ->assertJsonPath('data.category', 'Entreprise')
            ->assertJsonPath('data.city', 'Marrakech');

        $this->assertDatabaseHas('clients', [
            'name' => 'Nouveau Client',
            'category' => 'Entreprise',
            'phone' => '0677777777',
            'city_id' => City::where('name', 'Marrakech')->value('id'),
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/clients/{client}
    // -------------------------------------------------------------------------

    public function test_show_returns_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/clients/{$this->client->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $this->client->id)
            ->assertJsonPath('data.name', 'Ahmed Benali');
    }

    public function test_show_returns_404_for_unknown_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->getJson('/api/clients/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // PUT /api/clients/{client}
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

        $this->putJson("/api/clients/{$this->client->id}", ['name' => 'X'])->assertForbidden();
    }

    public function test_update_modifies_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        City::firstOrCreate(['name' => 'Agadir']);

        $response = $this->putJson("/api/clients/{$this->client->id}", [
            'name' => 'Ahmed Benali Updated',
            'category' => 'Entreprise',
            'city' => 'Agadir',
            'credit_limit' => 3000,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'Ahmed Benali Updated')
            ->assertJsonPath('data.city', 'Agadir');

        $this->assertDatabaseHas('clients', [
            'id' => $this->client->id,
            'name' => 'Ahmed Benali Updated',
            'city_id' => City::where('name', 'Agadir')->value('id'),
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/clients/{client}
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

        $this->deleteJson("/api/clients/{$this->client->id}")->assertForbidden();
    }

    public function test_destroy_deletes_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->deleteJson("/api/clients/{$this->client->id}")->assertNoContent();

        $this->assertDatabaseMissing('clients', ['id' => $this->client->id]);
    }

    // -------------------------------------------------------------------------
    // GET /api/clients/duplicates/check
    // -------------------------------------------------------------------------

    public function test_duplicates_requires_authentication(): void
    {
        $this->getJson('/api/clients/duplicates/check')->assertUnauthorized();
    }

    public function test_duplicates_returns_empty_when_no_query(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients/duplicates/check');

        $response->assertOk()
            ->assertJsonPath('matches', []);
    }

    public function test_duplicates_finds_match_by_name(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients/duplicates/check?name=Ahmed');

        $response->assertOk();

        $matches = $response->json('matches');
        $this->assertNotEmpty($matches);

        $foundNames = array_column($matches, 'name');
        $found = array_filter($foundNames, fn ($n) => str_contains(strtolower($n), 'ahmed'));
        $this->assertNotEmpty($found);
    }

    public function test_duplicates_finds_match_by_phone(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/clients/duplicates/check?phone=0612345678');

        $response->assertOk();

        $matches = $response->json('matches');
        $this->assertNotEmpty($matches);
        $this->assertEquals($this->client->id, $matches[0]['id']);
    }

    public function test_duplicates_excludes_except_id(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/clients/duplicates/check?name=Ahmed&except_id={$this->client->id}");

        $response->assertOk();

        $ids = array_column($response->json('matches'), 'id');
        $this->assertNotContains($this->client->id, $ids);
    }
}
