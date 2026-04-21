<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CompanySettingsApiTest extends TestCase
{
    use DatabaseTransactions;

    protected string $baseUrl = '/api/settings/company';

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', function () {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            })->name('login');
        }

        $this->ensureUsersTableExists();
        $this->ensurePermissionTablesExist();
        $this->ensureCompanySettingsTableExists();

        foreach ([
            'view settings',
            'edit settings',
        ] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
    }

    protected function ensureUsersTableExists(): void
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

    protected function ensurePermissionTablesExist(): void
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

    protected function ensureCompanySettingsTableExists(): void
    {
        if (! Schema::hasTable('company_settings')) {
            Schema::create('company_settings', function (Blueprint $table) {
                $table->id();
                $table->string('company_name');
                $table->string('legal_name')->nullable();
                $table->string('email')->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('address', 500)->nullable();
                $table->string('city')->nullable();
                $table->string('state')->nullable();
                $table->string('postal_code', 50)->nullable();
                $table->string('country')->nullable();
                $table->string('tax_id')->nullable();
                $table->string('rc')->nullable();
                $table->string('ice')->nullable();
                $table->string('cnss')->nullable();
                $table->string('patente')->nullable();
                $table->string('logo_path')->nullable();
                $table->string('favicon_path')->nullable();
                $table->string('theme_mode')->default('system');
                $table->string('primary_color', 7)->default('#ff2d37');
                $table->string('accent_color', 7)->default('#1e293b');
                $table->string('surface_color', 7)->default('#ffffff');
                $table->string('menu_layout')->default('vertical');
                $table->string('navbar_variant')->default('default');
                $table->string('content_width')->default('full');
                $table->timestamps();
            });
        }
    }

    protected function authenticateWithPermissions(array $permissions = []): User
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

    public function test_show_requires_authentication(): void
    {
        $response = $this->getJson($this->baseUrl);

        $response->assertUnauthorized();
    }

    public function test_show_forbids_user_without_view_permission(): void
    {
        $this->authenticateWithPermissions();

        $response = $this->getJson($this->baseUrl);

        $response->assertForbidden();
    }

    public function test_show_returns_default_company_settings_shape(): void
    {
        $this->authenticateWithPermissions(['view settings']);

        $response = $this->getJson($this->baseUrl);

        $response
            ->assertOk()
            ->assertJsonStructure([
                'id',
                'company_name',
                'legal_name',
                'email',
                'phone',
                'address',
                'city',
                'state',
                'postal_code',
                'country',
                'tax_id',
                'rc',
                'ice',
                'cnss',
                'patente',
                'logo_path',
                'favicon_path',
                'theme_mode',
                'primary_color',
                'accent_color',
                'surface_color',
                'menu_layout',
                'navbar_variant',
                'content_width',
                'created_at',
                'updated_at',
            ])
            ->assertJsonPath('company_name', '')
            ->assertJsonPath('legal_name', null)
            ->assertJsonPath('ice', null)
            ->assertJsonPath('theme_mode', 'system')
            ->assertJsonPath('menu_layout', 'vertical');
    }

    public function test_show_returns_persisted_settings(): void
    {
        CompanySetting::query()->create([
            'company_name' => 'Pneuma SARL',
            'legal_name' => 'Pneuma Trading SARL',
            'email' => 'contact@pneuma.ma',
            'phone' => '0522000000',
            'address' => 'Bd Exemple',
            'city' => 'Casablanca',
            'state' => 'Casablanca-Settat',
            'postal_code' => '20000',
            'country' => 'Maroc',
            'tax_id' => 'TAX123',
            'rc' => 'RC456',
            'ice' => 'ICE789',
            'cnss' => 'CNSS321',
            'patente' => 'PAT654',
            'logo_path' => 'settings/company/logo.png',
            'favicon_path' => 'settings/company/favicon.ico',
            'theme_mode' => 'dark',
            'primary_color' => '#112233',
            'accent_color' => '#334455',
            'surface_color' => '#ffffff',
            'menu_layout' => 'horizontal',
            'navbar_variant' => 'compact',
            'content_width' => 'boxed',
        ]);

        $this->authenticateWithPermissions(['view settings']);

        $response = $this->getJson($this->baseUrl);

        $response
            ->assertOk()
            ->assertJsonPath('company_name', 'Pneuma SARL')
            ->assertJsonPath('city', 'Casablanca')
            ->assertJsonPath('ice', 'ICE789')
            ->assertJsonPath('theme_mode', 'dark')
            ->assertJsonPath('menu_layout', 'horizontal');
    }

    public function test_update_requires_authentication(): void
    {
        $response = $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma SARL',
        ]);

        $response->assertUnauthorized();
    }

    public function test_update_forbids_user_without_edit_permission(): void
    {
        $this->authenticateWithPermissions();

        $response = $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma SARL',
        ]);

        $response->assertForbidden();
    }

    public function test_update_persists_company_settings(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $payload = [
            'company_name' => 'Pneuma SARL',
            'legal_name' => 'Pneuma Trading SARL',
            'email' => 'contact@pneuma.ma',
            'phone' => '0522000000',
            'address' => 'Bd Exemple',
            'city' => 'Casablanca',
            'state' => 'Casablanca-Settat',
            'postal_code' => '20000',
            'country' => 'Maroc',
            'tax_id' => 'TAX123',
            'rc' => 'RC456',
            'ice' => 'ICE789',
            'cnss' => 'CNSS321',
            'patente' => 'PAT654',
        ];

        $response = $this->putJson($this->baseUrl, $payload);

        $response
            ->assertOk()
            ->assertJsonPath('company_name', 'Pneuma SARL')
            ->assertJsonPath('legal_name', 'Pneuma Trading SARL')
            ->assertJsonPath('tax_id', 'TAX123');

        $this->assertDatabaseHas('company_settings', [
            'company_name' => 'Pneuma SARL',
            'ice' => 'ICE789',
        ]);
    }

    public function test_update_modifies_existing_settings_record(): void
    {
        $settings = CompanySetting::query()->create([
            'company_name' => 'Old Name',
            'legal_name' => null,
            'email' => null,
            'phone' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'postal_code' => null,
            'country' => null,
            'tax_id' => null,
            'rc' => null,
            'ice' => null,
            'cnss' => null,
            'patente' => null,
            'logo_path' => null,
            'favicon_path' => null,
            'theme_mode' => 'system',
            'primary_color' => '#ff2d37',
            'accent_color' => '#1e293b',
            'surface_color' => '#ffffff',
            'menu_layout' => 'vertical',
            'navbar_variant' => 'default',
            'content_width' => 'full',
        ]);

        $this->authenticateWithPermissions(['edit settings']);

        $response = $this->putJson($this->baseUrl, [
            'company_name' => 'New Name',
            'email' => 'info@pneuma.ma',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('id', $settings->id)
            ->assertJsonPath('company_name', 'New Name')
            ->assertJsonPath('email', 'info@pneuma.ma');

        $this->assertSame(1, CompanySetting::query()->count());
        $this->assertDatabaseHas('company_settings', [
            'id' => $settings->id,
            'company_name' => 'New Name',
        ]);
    }

    public function test_update_validates_payload(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $response = $this->putJson($this->baseUrl, [
            'company_name' => '',
            'email' => 'invalid-email',
            'primary_color' => 'not-a-color',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'company_name',
                'email',
                'primary_color',
            ]);
    }
}
