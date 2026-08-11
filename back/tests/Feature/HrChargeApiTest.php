<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class HrChargeApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    private User $employee;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view hr-charges', 'create hr-charges', 'edit hr-charges', 'delete hr-charges',
            'view cash-flow', 'create cash-flow', 'edit cash-flow', 'delete cash-flow',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $adminRole = Role::findOrCreate('Administrator', 'web');
        $adminRole->syncPermissions(Permission::all());

        $this->admin = User::query()->create([
            'name' => 'Admin RH',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->admin->assignRole($adminRole);

        $this->employee = User::query()->create([
            'name' => 'A. Bennani',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
            'salary' => 6500,
        ]);
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

    private function validLine(int $accountId, array $overrides = []): array
    {
        return array_merge([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'subcategory' => 'Salaires',
            'amount' => 6500,
            'account_id' => $accountId,
            'method' => 'Virement',
            'description' => 'Paie de juillet',
        ], $overrides);
    }

    // -------------------------------------------------------------------------
    // Authentication / permissions
    // -------------------------------------------------------------------------

    public function test_endpoints_require_authentication(): void
    {
        $this->getJson('/api/hr-charges')->assertUnauthorized();
        $this->getJson('/api/hr-charges-summary')->assertUnauthorized();
        $this->getJson('/api/hr-charges-filters')->assertUnauthorized();
        $this->postJson('/api/hr-charges', [])->assertUnauthorized();
    }

    public function test_index_requires_view_hr_charges_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view cash-flow']);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/hr-charges')->assertForbidden();
    }

    public function test_store_requires_create_hr_charges_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view hr-charges']);
        Sanctum::actingAs($guest, [], 'web');

        $account = $this->createAccount();

        $this->postJson('/api/hr-charges', ['lines' => [$this->validLine($account->id)]])
            ->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Store (batch)
    // -------------------------------------------------------------------------

    public function test_store_validates_lines_required(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $this->postJson('/api/hr-charges', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lines']);
    }

    public function test_store_rejects_invalid_subcategory(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $this->postJson('/api/hr-charges', [
            'lines' => [$this->validLine($account->id, ['subcategory' => 'Not A Real Subcategory'])],
        ])->assertUnprocessable()->assertJsonValidationErrors(['lines.0.subcategory']);
    }

    public function test_store_creates_a_batch_of_real_transactions(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $response = $this->postJson('/api/hr-charges', [
            'lines' => [
                $this->validLine($account->id, ['subcategory' => 'Salaires', 'amount' => 6500]),
                $this->validLine($account->id, ['subcategory' => 'CNSS (part patronale)', 'amount' => 572]),
            ],
        ]);

        $response->assertCreated()->assertJsonCount(2);

        $this->assertDatabaseHas('transactions', [
            'type' => 'expense',
            'category' => 'Charges RH',
            'subcategory' => 'Salaires',
            'amount' => 6500,
            'employee_id' => $this->employee->id,
            'account_id' => $account->id,
        ]);
        $this->assertDatabaseHas('transactions', [
            'type' => 'expense',
            'category' => 'Charges RH',
            'subcategory' => 'CNSS (part patronale)',
            'amount' => 572,
        ]);
    }

    // `description` is required at the DB level (transactions.description is
    // NOT NULL) but optional in the batch form — a blank/omitted value must
    // fall back to a generated description instead of hitting the DB with null.
    public function test_store_generates_a_description_when_none_is_provided(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $response = $this->postJson('/api/hr-charges', [
            'lines' => [$this->validLine($account->id, ['subcategory' => 'Salaires', 'description' => null])],
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('transactions', [
            'category' => 'Charges RH',
            'subcategory' => 'Salaires',
            'description' => "Salaires — {$this->employee->name}",
        ]);
    }

    // -------------------------------------------------------------------------
    // Index / summary — scoped to the confidential category tree only
    // -------------------------------------------------------------------------

    public function test_index_scopes_to_the_requested_month(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $this->postJson('/api/hr-charges', [
            'lines' => [$this->validLine($account->id, ['date' => '2026-07-15'])],
        ])->assertCreated();
        $this->postJson('/api/hr-charges', [
            'lines' => [$this->validLine($account->id, ['date' => '2026-06-15'])],
        ])->assertCreated();

        $response = $this->getJson('/api/hr-charges?year=2026&month=7');

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_index_does_not_leak_ordinary_cash_flow_transactions(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        Transaction::query()->create([
            'date' => '2026-07-10',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Fournisseur',
            'description' => 'Ordinary expense',
            'account_id' => $account->id,
            'user_id' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/hr-charges?year=2026&month=7');

        $response->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_summary_returns_total_by_subcategory_and_employee_count(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $this->postJson('/api/hr-charges', [
            'lines' => [
                $this->validLine($account->id, ['subcategory' => 'Salaires', 'amount' => 6500]),
                $this->validLine($account->id, ['subcategory' => 'CNSS (part patronale)', 'amount' => 572]),
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/hr-charges-summary?year=2026&month=7');

        $response->assertOk()
            ->assertJsonPath('total', 7072)
            ->assertJsonPath('employee_count', 1)
            ->assertJsonPath('by_subcategory.Salaires', 6500);
    }

    public function test_filters_returns_employees_subcategories_and_accounts(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->getJson('/api/hr-charges-filters');

        $response->assertOk()->assertJsonStructure(['employees', 'subcategories', 'accounts']);
        $this->assertTrue(collect($response->json('subcategories'))->pluck('name')->contains('Salaires'));
    }

    // -------------------------------------------------------------------------
    // Update / delete — only confidential transactions may be touched here
    // -------------------------------------------------------------------------

    public function test_update_modifies_an_hr_charge(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $store = $this->postJson('/api/hr-charges', ['lines' => [$this->validLine($account->id)]]);
        $id = $store->json('0.id');

        $response = $this->putJson("/api/hr-charges/{$id}", ['amount' => 7000]);

        $response->assertOk()->assertJsonPath('amount', 7000);
        $this->assertDatabaseHas('transactions', ['id' => $id, 'amount' => 7000]);
    }

    public function test_update_rejects_an_ordinary_transaction(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $ordinary = Transaction::query()->create([
            'date' => '2026-07-10',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Fournisseur',
            'description' => 'Ordinary expense',
            'account_id' => $account->id,
            'user_id' => $this->admin->id,
        ]);

        $this->putJson("/api/hr-charges/{$ordinary->id}", ['amount' => 999])->assertNotFound();
    }

    public function test_destroy_deletes_an_hr_charge(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $store = $this->postJson('/api/hr-charges', ['lines' => [$this->validLine($account->id)]]);
        $id = $store->json('0.id');

        $this->deleteJson("/api/hr-charges/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('transactions', ['id' => $id]);
    }

    public function test_destroy_rejects_an_ordinary_transaction(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');
        $account = $this->createAccount();

        $ordinary = Transaction::query()->create([
            'date' => '2026-07-10',
            'amount' => 100,
            'type' => 'expense',
            'category' => 'Charge',
            'method' => 'Espèces',
            'person' => 'Fournisseur',
            'description' => 'Ordinary expense',
            'account_id' => $account->id,
            'user_id' => $this->admin->id,
        ]);

        $this->deleteJson("/api/hr-charges/{$ordinary->id}")->assertNotFound();
        $this->assertDatabaseHas('transactions', ['id' => $ordinary->id]);
    }

    // -------------------------------------------------------------------------
    // Employee HR fields
    // -------------------------------------------------------------------------

    public function test_update_employee_persists_salary_and_cnss(): void
    {
        Sanctum::actingAs($this->admin, [], 'web');

        $response = $this->putJson("/api/hr-employees/{$this->employee->id}", [
            'salary' => 7200,
            'cnss_number' => '1234567',
            'hire_date' => '2022-03-01',
        ]);

        $response->assertOk()->assertJsonPath('salary', '7200.00');
        $this->assertDatabaseHas('users', ['id' => $this->employee->id, 'cnss_number' => '1234567']);
    }

    public function test_update_employee_requires_edit_hr_charges_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view hr-charges']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/hr-employees/{$this->employee->id}", ['salary' => 1000])
            ->assertForbidden();
    }
}
