<?php

namespace Tests\Feature;

use App\Models\City;
use App\Models\CompanySetting;
use App\Models\PrimeThreshold;
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

    /** Réglages de thème retirés — refonte 2b, étape 7a puis leur nettoyage. */
    private const RETIRED_THEME_FIELDS = [
        'theme_mode',
        'primary_color',
        'accent_color',
        'surface_color',
        'menu_layout',
        'navbar_variant',
    ];

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
                'content_width',
                'created_at',
                'updated_at',
            ])
            ->assertJsonPath('company_name', '')
            ->assertJsonPath('legal_name', null)
            ->assertJsonPath('ice', null)
            ->assertJsonPath('content_width', 'full');
    }

    /**
     * Le personnalisateur de thème a quitté l'écran à l'étape 7a, et ses
     * couleurs ne pilotaient plus rien. Le mode sombre, lui, s'appliquait
     * encore à moitié sur un poste réglé en sombre. Plus rien n'en reste.
     */
    public function test_the_retired_theme_settings_are_gone(): void
    {
        $this->authenticateWithPermissions(['view settings']);

        $response = $this->getJson($this->baseUrl)->assertOk();

        foreach (self::RETIRED_THEME_FIELDS as $field) {
            $response->assertJsonMissingPath($field);
            $this->assertFalse(Schema::hasColumn('company_settings', $field), "La colonne {$field} existe encore.");
        }
    }

    public function test_update_ignores_retired_theme_settings(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        // Une ancienne version de l'écran peut encore les envoyer : rien ne
        // doit échouer, ni s'enregistrer.
        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'theme_mode' => 'dark',
            'primary_color' => 'not-a-color',
        ])
            ->assertOk()
            ->assertJsonMissingPath('theme_mode')
            ->assertJsonMissingPath('primary_color');
    }

    public function test_update_persists_the_content_width(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'content_width' => 'compact',
        ])
            ->assertOk()
            ->assertJsonPath('content_width', 'compact');

        $this->assertDatabaseHas('company_settings', ['content_width' => 'compact']);
    }

    public function test_show_returns_persisted_settings(): void
    {
        City::firstOrCreate(['name' => 'Casablanca']);

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
            'content_width' => 'boxed',
        ]);

        $this->authenticateWithPermissions(['view settings']);

        $response = $this->getJson($this->baseUrl);

        $response
            ->assertOk()
            ->assertJsonPath('company_name', 'Pneuma SARL')
            ->assertJsonPath('city', 'Casablanca')
            ->assertJsonPath('ice', 'ICE789')
            ->assertJsonPath('content_width', 'boxed');
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
            'content_width' => 'immense',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'company_name',
                'email',
                'content_width',
            ]);
    }

    // -------------------------------------------------------------------------
    // Jours de fermeture — refonte 2b, 9b
    // -------------------------------------------------------------------------

    public function test_closing_days_default_to_sunday_only(): void
    {
        CompanySetting::query()->create(['company_name' => 'Sans fermeture']);

        $this->authenticateWithPermissions(['view settings']);

        $this->getJson($this->baseUrl)
            ->assertOk()
            ->assertJsonPath('closed_weekdays', [0])
            ->assertJsonPath('holidays', []);
    }

    public function test_update_persists_closing_days_and_holidays(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'closed_weekdays' => [0, 5],
            'holidays' => ['2026-01-01', '2026-07-30'],
        ])
            ->assertOk()
            ->assertJsonPath('closed_weekdays', [0, 5])
            ->assertJsonPath('holidays', ['2026-01-01', '2026-07-30']);
    }

    public function test_a_shop_open_every_day_is_an_empty_list_not_a_default(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'closed_weekdays' => [],
        ])
            ->assertOk()
            ->assertJsonPath('closed_weekdays', []);
    }

    public function test_update_rejects_impossible_closing_days(): void
    {
        $this->authenticateWithPermissions(['edit settings']);

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'closed_weekdays' => [7],
            'holidays' => ['31/12/2026'],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['closed_weekdays.0', 'holidays.0']);
    }

    // -------------------------------------------------------------------------
    // Historique du seuil de prime — refonte 2b, 9b
    // -------------------------------------------------------------------------

    public function test_changing_the_prime_threshold_appends_a_history_row(): void
    {
        CompanySetting::query()->create(['company_name' => 'Pneuma', 'prime_threshold' => 400]);

        $user = $this->authenticateWithPermissions(['edit settings']);
        $before = PrimeThreshold::query()->count();

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma',
            'prime_threshold' => 900,
        ])->assertOk();

        $this->assertSame($before + 1, PrimeThreshold::query()->count());

        $row = PrimeThreshold::query()->latest('id')->first();
        $this->assertSame(900, $row->threshold);
        // Daté du jour du changement, pas du premier du mois : un seuil relevé
        // en cours de mois n'a pas valu pour les jours déjà écoulés.
        $this->assertSame(now()->toDateString(), $row->effective_from->toDateString());
        $this->assertSame($user->id, $row->created_by);
    }

    public function test_saving_settings_without_touching_the_threshold_writes_nothing(): void
    {
        CompanySetting::query()->create(['company_name' => 'Pneuma', 'prime_threshold' => 400]);

        $this->authenticateWithPermissions(['edit settings']);
        $before = PrimeThreshold::query()->count();

        $this->putJson($this->baseUrl, [
            'company_name' => 'Pneuma renommé',
            'prime_threshold' => 400,
        ])->assertOk();

        $this->assertSame($before, PrimeThreshold::query()->count());
    }
}
