<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ActivityLogApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view activity-log', 'view hr-charges', 'create hr-charges', 'edit hr-charges',
            'view cash-flow', 'create cash-flow', 'edit cash-flow',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $this->admin = User::query()->create([
            'name' => 'Admin Log',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->admin->assignRole($adminRole);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Limited User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    private function createAccount(array $attributes = []): Account
    {
        return Account::query()->create(array_merge([
            'name' => 'Compte '.fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ], $attributes));
    }

    private function createConfidentialCategory(): TransactionCategory
    {
        return TransactionCategory::query()->firstOrCreate(
            ['name' => 'Charges RH Log Test', 'type' => 'expense', 'parent_id' => null],
            ['is_system' => false, 'is_active' => true, 'counts_as_expense' => true, 'is_confidential' => true, 'sort_order' => 0],
        );
    }

    private function createOrdinaryTransaction(int $accountId, array $attributes = []): Transaction
    {
        return Transaction::query()->create(array_merge([
            'date' => '2026-07-10',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Fournisseur',
            'description' => 'Ordinary expense',
            'account_id' => $accountId,
            'user_id' => $this->admin->id,
        ], $attributes));
    }

    // -------------------------------------------------------------------------
    // GET /api/activity-logs — is_confidential filtering
    // -------------------------------------------------------------------------

    public function test_admin_with_view_hr_charges_sees_confidential_transaction_log_entries(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        // Relies on the real "Charges RH" / "Salaire" categories seeded by
        // 2026_08_11_000002_seed_charges_rh_categories.php (consolidated by
        // 2026_08_13_000001_consolidate_charges_rh_subcategories.php) — same
        // pattern as HrChargeApiTest::validLine().
        $this->postJson('/api/hr-charges', [
            'lines' => [[
                'employee_id' => $this->admin->id,
                'date' => '2026-07-15',
                'subcategory' => 'Salaire',
                'amount' => 4750,
                'account_id' => $account->id,
                'method' => 'Virement',
                'description' => 'Salaire Azeddine',
            ]],
        ])->assertCreated();

        $response = $this->getJson('/api/activity-logs?entity_type=transaction&per_page=200');

        $response->assertOk();
        $this->assertTrue(collect($response->json('data'))->contains(
            fn ($row) => str_contains($row['description'] ?? '', 'Charges RH')
        ));
    }

    public function test_user_with_view_activity_log_but_not_hr_charges_does_not_see_confidential_entries(): void
    {
        $category = $this->createConfidentialCategory();
        $account = $this->createAccount();

        $log = ActivityLog::create([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'is_confidential' => true,
            'entity_id' => 9999,
            'entity_label' => 'Transaction #9999',
            'description' => 'Transaction #9999 créée — Dépense, 4 750.00 MAD (Charges RH Log Test)',
            'properties' => ['before' => null, 'after' => ['category' => $category->name, 'person' => 'Azeddine Secret']],
            'user_id' => $this->admin->id,
            'user_name' => $this->admin->name,
        ]);

        $guest = $this->createUserWithPermissions(['view activity-log']);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->getJson('/api/activity-logs?per_page=200');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($log->id));
    }

    public function test_user_without_hr_charges_still_sees_ordinary_transaction_log_entries(): void
    {
        $account = $this->createAccount();

        $log = ActivityLog::create([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'is_confidential' => false,
            'entity_id' => 8888,
            'entity_label' => 'Transaction #8888',
            'description' => 'Transaction #8888 créée — Dépense, 100.00 MAD (Charge)',
            'properties' => ['before' => null, 'after' => ['category' => 'Charge']],
            'user_id' => $this->admin->id,
            'user_name' => $this->admin->name,
        ]);

        $guest = $this->createUserWithPermissions(['view activity-log']);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->getJson('/api/activity-logs?per_page=200');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($log->id));
    }

    public function test_transaction_moved_out_of_confidential_category_stays_masked_on_update(): void
    {
        $category = $this->createConfidentialCategory();
        $account = $this->createAccount();
        $tx = $this->createOrdinaryTransaction($account->id, ['category' => $category->name]);

        Sanctum::actingAs($this->admin, [], 'web');
        $this->putJson("/api/transactions/{$tx->id}", [
            'date' => '2026-07-10',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Fournisseur',
            'description' => 'Now ordinary',
            'account_id' => $account->id,
        ])->assertOk();

        $log = ActivityLog::where('entity_type', ActivityLog::ENTITY_TRANSACTION)
            ->where('entity_id', $tx->id)
            ->where('action', ActivityLog::ACTION_UPDATE)
            ->latest('id')
            ->first();

        $this->assertNotNull($log);
        $this->assertTrue((bool) $log->is_confidential);
    }

    // -------------------------------------------------------------------------
    // GET /api/activity-logs-filters — dropdown lists must not leak either
    // -------------------------------------------------------------------------

    public function test_filters_excludes_a_user_who_only_appears_on_confidential_entries(): void
    {
        $category = $this->createConfidentialCategory();

        $hrOnlyActor = User::query()->create([
            'name' => 'Payroll Clerk Only',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000099',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        ActivityLog::create([
            'action' => ActivityLog::ACTION_CREATE,
            'entity_type' => ActivityLog::ENTITY_TRANSACTION,
            'is_confidential' => true,
            'entity_id' => 7777,
            'entity_label' => 'Transaction #7777',
            'description' => 'Transaction #7777 créée — Dépense, 5 000.00 MAD (Charges RH Log Test)',
            'properties' => ['before' => null, 'after' => ['category' => $category->name]],
            'user_id' => $hrOnlyActor->id,
            'user_name' => $hrOnlyActor->name,
        ]);

        $guest = $this->createUserWithPermissions(['view activity-log']);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->getJson('/api/activity-logs-filters');

        $response->assertOk();
        $names = collect($response->json('users'))->pluck('name');
        $this->assertFalse($names->contains('Payroll Clerk Only'));
    }
}
