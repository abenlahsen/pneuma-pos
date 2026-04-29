<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Transaction;
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

class AccountAndTransactionTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view accounts', 'create accounts', 'edit accounts', 'delete accounts', 'transfer accounts',
            'view cash-flow', 'create cash-flow', 'edit cash-flow', 'delete cash-flow',
        ] as $perm) {
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
    }

    // =========================================================================
    // ACCOUNTS
    // =========================================================================

    // GET /api/accounts

    public function test_accounts_index_requires_authentication(): void
    {
        $this->getJson('/api/accounts')->assertUnauthorized();
    }

    public function test_accounts_index_requires_view_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/accounts')->assertForbidden();
    }

    public function test_accounts_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createAccount(['name' => 'Caisse Principale']);
        $this->createAccount(['name' => 'Banque CIH']);

        $response = $this->getJson('/api/accounts');

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_accounts_index_filters_by_search(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createAccount(['name' => 'Caisse Principale']);
        $this->createAccount(['name' => 'Banque Populaire']);

        $response = $this->getJson('/api/accounts?search=Caisse');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Caisse Principale');
    }

    public function test_accounts_index_returns_all_when_all_flag_set(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->createAccount(['name' => 'Compte A']);
        $this->createAccount(['name' => 'Compte B']);

        $response = $this->getJson('/api/accounts?all=1');

        $response->assertOk()
            ->assertJsonCount(2);
    }

    // GET /api/accounts/{id}

    public function test_accounts_show_returns_account_with_balances(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount(['name' => 'Caisse Test', 'initial_balance' => 500]);

        $response = $this->getJson("/api/accounts/{$account->id}");

        $response->assertOk()
            ->assertJsonPath('id', $account->id)
            ->assertJsonPath('name', 'Caisse Test')
            ->assertJsonStructure(['current_balance', 'expected_balance']);
    }

    // POST /api/accounts

    public function test_accounts_store_requires_authentication(): void
    {
        $this->postJson('/api/accounts', [])->assertUnauthorized();
    }

    public function test_accounts_store_requires_create_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view accounts']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/accounts', $this->validAccountPayload())->assertForbidden();
    }

    public function test_accounts_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/accounts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'type']);
    }

    public function test_accounts_store_validates_type_enum(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/accounts', array_merge($this->validAccountPayload(), ['type' => 'invalid']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_accounts_store_creates_account(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/accounts', $this->validAccountPayload());

        $response->assertCreated()
            ->assertJsonPath('name', 'Nouvelle Caisse')
            ->assertJsonPath('type', 'cash');

        $this->assertDatabaseHas('accounts', ['name' => 'Nouvelle Caisse', 'type' => 'cash']);
    }

    // PUT /api/accounts/{id}

    public function test_accounts_update_requires_edit_permission(): void
    {
        $account = $this->createAccount();
        $guest = $this->createUserWithPermissions(['view accounts']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/accounts/{$account->id}", ['name' => 'Updated'])->assertForbidden();
    }

    public function test_accounts_update_modifies_account(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount(['name' => 'Old Name']);

        $response = $this->putJson("/api/accounts/{$account->id}", [
            'name' => 'New Name',
            'type' => 'bank',
            'is_active' => false,
        ]);

        $response->assertOk()->assertJsonPath('name', 'New Name');
        $this->assertDatabaseHas('accounts', ['id' => $account->id, 'name' => 'New Name']);
    }

    // DELETE /api/accounts/{id}

    public function test_accounts_destroy_requires_delete_permission(): void
    {
        $account = $this->createAccount();
        $guest = $this->createUserWithPermissions(['view accounts']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/accounts/{$account->id}")->assertForbidden();
    }

    public function test_accounts_destroy_deletes_account(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount(['name' => 'To Delete']);

        $this->deleteJson("/api/accounts/{$account->id}")->assertNoContent();

        $this->assertDatabaseMissing('accounts', ['id' => $account->id]);
    }

    public function test_accounts_destroy_rejects_account_with_transactions(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $this->createTransaction(['account_id' => $account->id]);

        $response = $this->deleteJson("/api/accounts/{$account->id}");

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Impossible de supprimer ce compte car il contient des transactions.');

        $this->assertDatabaseHas('accounts', ['id' => $account->id]);
    }

    // POST /api/accounts/transfer

    public function test_accounts_transfer_requires_transfer_permission(): void
    {
        $source = $this->createAccount(['name' => 'Source ' . fake()->unique()->word()]);
        $dest = $this->createAccount(['name' => 'Dest ' . fake()->unique()->word()]);
        $guest = $this->createUserWithPermissions(['view accounts']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/accounts/transfer', [
            'source_account_id' => $source->id,
            'destination_account_id' => $dest->id,
            'amount' => 100,
            'date' => '2026-04-15',
        ])->assertForbidden();
    }

    public function test_accounts_transfer_validates_different_accounts(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();

        $this->postJson('/api/accounts/transfer', [
            'source_account_id' => $account->id,
            'destination_account_id' => $account->id,
            'amount' => 100,
            'date' => '2026-04-15',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['destination_account_id']);
    }

    public function test_accounts_transfer_creates_two_linked_transactions(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $source = $this->createAccount(['name' => 'Source ' . fake()->unique()->numerify('###')]);
        $dest = $this->createAccount(['name' => 'Dest ' . fake()->unique()->numerify('###')]);

        $response = $this->postJson('/api/accounts/transfer', [
            'source_account_id' => $source->id,
            'destination_account_id' => $dest->id,
            'amount' => 250.00,
            'date' => '2026-04-15',
            'description' => 'Virement test',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['transfer_id', 'expense', 'income']);

        $transferId = $response->json('transfer_id');

        $this->assertDatabaseHas('transactions', [
            'account_id' => $source->id,
            'type' => 'expense',
            'amount' => 250.00,
            'transfer_id' => $transferId,
        ]);

        $this->assertDatabaseHas('transactions', [
            'account_id' => $dest->id,
            'type' => 'income',
            'amount' => 250.00,
            'transfer_id' => $transferId,
        ]);
    }

    // =========================================================================
    // TRANSACTIONS
    // =========================================================================

    // GET /api/transactions

    public function test_transactions_index_requires_authentication(): void
    {
        $this->getJson('/api/transactions')->assertUnauthorized();
    }

    public function test_transactions_index_requires_view_cashflow_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/transactions')->assertForbidden();
    }

    public function test_transactions_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $this->createTransaction(['account_id' => $account->id, 'description' => 'Tx 1']);
        $this->createTransaction(['account_id' => $account->id, 'description' => 'Tx 2']);

        $response = $this->getJson('/api/transactions');

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_transactions_index_filters_by_type(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $this->createTransaction(['account_id' => $account->id, 'type' => 'income']);
        $this->createTransaction(['account_id' => $account->id, 'type' => 'expense']);

        $response = $this->getJson('/api/transactions?type=income');

        $response->assertOk()->assertJsonCount(1, 'data');
        $this->assertEquals('income', $response->json('data.0.type'));
    }

    public function test_transactions_index_filters_by_date_range(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $this->createTransaction(['account_id' => $account->id, 'date' => '2026-01-15']);
        $this->createTransaction(['account_id' => $account->id, 'date' => '2026-04-15']);

        $response = $this->getJson('/api/transactions?date_from=2026-04-01&date_to=2026-04-30');

        $response->assertOk()->assertJsonCount(1, 'data');
    }

    // POST /api/transactions

    public function test_transactions_store_requires_create_cashflow_permission(): void
    {
        $account = $this->createAccount();
        $guest = $this->createUserWithPermissions(['view cash-flow']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/transactions', $this->validTransactionPayload($account->id))
            ->assertForbidden();
    }

    public function test_transactions_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/transactions', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['account_id', 'type', 'amount', 'date', 'category', 'method', 'person']);
    }

    public function test_transactions_store_creates_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();

        $response = $this->postJson('/api/transactions', $this->validTransactionPayload($account->id));

        $response->assertCreated()
            ->assertJsonPath('type', 'income')
            ->assertJsonPath('amount', '350.00')
            ->assertJsonPath('account_id', $account->id);

        $this->assertDatabaseHas('transactions', [
            'type' => 'income',
            'amount' => 350.00,
            'account_id' => $account->id,
            'user_id' => $this->user->id,
        ]);
    }

    // GET /api/transactions/{id}

    public function test_transactions_show_returns_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $tx = $this->createTransaction(['account_id' => $account->id, 'description' => 'Mon paiement']);

        $response = $this->getJson("/api/transactions/{$tx->id}");

        $response->assertOk()
            ->assertJsonPath('id', $tx->id)
            ->assertJsonPath('description', 'Mon paiement')
            ->assertJsonStructure(['account']);
    }

    // PUT /api/transactions/{id}

    public function test_transactions_update_requires_edit_cashflow_permission(): void
    {
        $account = $this->createAccount();
        $tx = $this->createTransaction(['account_id' => $account->id]);
        $guest = $this->createUserWithPermissions(['view cash-flow']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/transactions/{$tx->id}", ['amount' => 999])->assertForbidden();
    }

    public function test_transactions_update_modifies_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $tx = $this->createTransaction(['account_id' => $account->id, 'amount' => 100]);

        $response = $this->putJson("/api/transactions/{$tx->id}", array_merge(
            $this->validTransactionPayload($account->id),
            ['amount' => 999, 'description' => 'Updated']
        ));

        $response->assertOk()->assertJsonPath('description', 'Updated');
        $this->assertDatabaseHas('transactions', ['id' => $tx->id, 'description' => 'Updated']);
    }

    // DELETE /api/transactions/{id}

    public function test_transactions_destroy_requires_delete_cashflow_permission(): void
    {
        $account = $this->createAccount();
        $tx = $this->createTransaction(['account_id' => $account->id]);
        $guest = $this->createUserWithPermissions(['view cash-flow']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/transactions/{$tx->id}")->assertForbidden();
    }

    public function test_transactions_destroy_deletes_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount();
        $tx = $this->createTransaction(['account_id' => $account->id]);

        $this->deleteJson("/api/transactions/{$tx->id}")->assertNoContent();

        $this->assertDatabaseMissing('transactions', ['id' => $tx->id]);
    }

    // GET /api/transactions-summary

    public function test_transactions_summary_returns_income_expenses_balance(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = $this->createAccount(['initial_balance' => 0, 'type' => 'cash']);
        $this->createTransaction(['account_id' => $account->id, 'type' => 'income', 'amount' => 1000, 'method' => 'Espèces', 'date' => now()->toDateString()]);
        $this->createTransaction(['account_id' => $account->id, 'type' => 'expense', 'amount' => 300, 'method' => 'Espèces', 'date' => now()->toDateString()]);

        $response = $this->getJson('/api/transactions-summary');

        $response->assertOk()
            ->assertJsonStructure(['income', 'expenses', 'balance', 'pending_income', 'pending_expense'])
            ->assertJsonPath('income', 1000)
            ->assertJsonPath('expenses', 300);
    }

    // GET /api/transactions-filters

    public function test_transactions_filters_returns_expected_keys(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/transactions-filters');

        $response->assertOk()
            ->assertJsonStructure(['categories', 'persons', 'partners', 'accounts']);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function validAccountPayload(): array
    {
        return [
            'name' => 'Nouvelle Caisse',
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ];
    }

    private function validTransactionPayload(int $accountId): array
    {
        return [
            'account_id' => $accountId,
            'type' => 'income',
            'amount' => 350.00,
            'date' => '2026-04-15',
            'category' => 'Produit',
            'method' => 'Espèces',
            'person' => 'Client Test',
            'description' => 'Paiement reçu',
            'reference' => null,
        ];
    }

    private function createAccount(array $attributes = []): Account
    {
        return Account::query()->create(array_merge([
            'name' => 'Compte ' . fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ], $attributes));
    }

    private function createTransaction(array $attributes = []): Transaction
    {
        return Transaction::query()->create(array_merge([
            'date' => '2026-04-15',
            'amount' => 100.00,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Espèces',
            'description' => 'Transaction test',
            'person' => 'Test',
            'partner' => '',
            'user_id' => $this->user->id,
        ], $attributes));
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

    // =========================================================================
    // Table setup (SQLite in-memory)
    // =========================================================================

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
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

    private function ensureAccountsTable(): void
    {
        if (Schema::hasTable('accounts')) {
            return;
        }
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('type');
            $table->text('description')->nullable();
            $table->decimal('initial_balance', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureTransactionsTable(): void
    {
        if (Schema::hasTable('transactions')) {
            return;
        }
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('type')->nullable();
            $table->string('category')->nullable();
            $table->string('method')->nullable();
            $table->string('description')->nullable();
            $table->string('person')->nullable();
            $table->string('partner')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->string('transfer_id')->nullable();
            $table->timestamps();
        });
    }
}
