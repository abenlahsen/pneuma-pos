<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    // -------------------------------------------------------------------------
    // POST /api/login
    // -------------------------------------------------------------------------

    public function test_login_validates_required_fields(): void
    {
        $response = $this->postJson('/api/login', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_validates_email_format(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'not-an-email',
            'password' => 'password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_fails_with_unknown_email(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'nobody@example.com',
            'password' => 'password',
        ]);

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'Les identifiants sont incorrects.');
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->createUser(['password' => Hash::make('correct-password')]);

        $response = $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'Les identifiants sont incorrects.');
    }

    public function test_login_succeeds_and_returns_token_and_user(): void
    {
        $this->createUser();

        $response = $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user', 'permissions', 'must_change_password'])
            ->assertJsonPath('user.email', 'user@test.com')
            ->assertJsonPath('must_change_password', false);

        $this->assertNotNull($response->json('token'));
    }

    public function test_login_returns_must_change_password_true_for_new_users(): void
    {
        $this->createUser(['must_change_password' => true]);

        $response = $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('must_change_password', true);
    }

    public function test_login_revokes_all_previous_tokens(): void
    {
        $user = $this->createUser();

        $oldToken = $user->createToken('old-token')->plainTextToken;

        $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'password123',
        ]);

        $tokenId = explode('|', $oldToken)[0];
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
    }

    public function test_login_includes_user_permissions(): void
    {
        $perm = Permission::findOrCreate('view sales', 'web');
        $user = $this->createUser();
        $user->givePermissionTo($perm);

        $response = $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $this->assertContains('view sales', $response->json('permissions'));
    }

    // -------------------------------------------------------------------------
    // GET /api/user
    // -------------------------------------------------------------------------

    public function test_user_requires_authentication(): void
    {
        $response = $this->getJson('/api/user');

        $response->assertUnauthorized();
    }

    public function test_user_returns_authenticated_user_data(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $response = $this->getJson('/api/user');

        $response->assertOk()
            ->assertJsonStructure(['user', 'permissions', 'must_change_password'])
            ->assertJsonPath('user.email', 'user@test.com');
    }

    // -------------------------------------------------------------------------
    // POST /api/logout
    // -------------------------------------------------------------------------

    public function test_logout_requires_authentication(): void
    {
        $response = $this->postJson('/api/logout');

        $response->assertUnauthorized();
    }

    public function test_logout_returns_success_message(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('auth-token')->plainTextToken;

        $response = $this->postJson('/api/logout', [], ['Authorization' => "Bearer {$token}"]);

        $response->assertOk()
            ->assertJsonPath('message', 'Déconnexion réussie.');
    }

    public function test_logout_invalidates_the_token(): void
    {
        $user = $this->createUser();
        $token = $user->createToken('auth-token')->plainTextToken;
        $tokenId = explode('|', $token)[0];

        $this->postJson('/api/logout', [], ['Authorization' => "Bearer {$token}"]);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
    }

    // -------------------------------------------------------------------------
    // POST /api/change-password
    // -------------------------------------------------------------------------

    public function test_change_password_requires_authentication(): void
    {
        $response = $this->postJson('/api/change-password', []);

        $response->assertUnauthorized();
    }

    public function test_change_password_validates_required_fields(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $response = $this->postJson('/api/change-password', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password', 'password']);
    }

    public function test_change_password_validates_password_confirmation(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $response = $this->postJson('/api/change-password', [
            'current_password' => 'password123',
            'password' => 'newpassword',
            'password_confirmation' => 'different',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_change_password_validates_minimum_length(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $response = $this->postJson('/api/change-password', [
            'current_password' => 'password123',
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_change_password_fails_with_wrong_current_password(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $response = $this->postJson('/api/change-password', [
            'current_password' => 'wrong-password',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Le mot de passe actuel est incorrect.');
    }

    public function test_change_password_succeeds_and_clears_must_change_flag(): void
    {
        $user = $this->createUser(['must_change_password' => true]);
        Sanctum::actingAs($user, [], 'web');

        $response = $this->postJson('/api/change-password', [
            'current_password' => 'password123',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Mot de passe modifié avec succès.');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'must_change_password' => false,
        ]);

        $this->assertTrue(Hash::check('newpassword123', $user->fresh()->password));
    }

    public function test_change_password_allows_login_with_new_password(): void
    {
        $user = $this->createUser();
        Sanctum::actingAs($user, [], 'web');

        $this->postJson('/api/change-password', [
            'current_password' => 'password123',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'user@test.com',
            'password' => 'newpassword123',
        ]);

        $response->assertOk();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function createUser(array $attributes = []): User
    {
        return User::query()->create(array_merge([
            'name' => 'Test User',
            'email' => 'user@test.com',
            'password' => Hash::make('password123'),
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ], $attributes));
    }

    // -------------------------------------------------------------------------
    // Table setup (SQLite in-memory)
    // -------------------------------------------------------------------------

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
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
}
