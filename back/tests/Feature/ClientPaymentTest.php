<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
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

class ClientPaymentTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Account $account;

    private Client $client;

    private Sale $saleA;

    private Sale $saleB;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view sales', 'manage sale-payments'] as $perm) {
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

        $this->account = Account::query()->create([
            'name' => 'Caisse Test '.fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $this->client = Client::query()->create([
            'name' => 'Client Multi',
        ]);

        $this->saleA = Sale::query()->create([
            'date' => '2026-04-01',
            'client_id' => $this->client->id,
            'total_quantity' => 4,
            'total_purchase' => 300.00,
            'total_sale' => 600.00,
            'margin' => 300.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $this->saleB = Sale::query()->create([
            'date' => '2026-04-05',
            'client_id' => $this->client->id,
            'total_quantity' => 2,
            'total_purchase' => 200.00,
            'total_sale' => 400.00,
            'margin' => 200.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/clients/{client}/unpaid-sales
    // -------------------------------------------------------------------------

    public function test_unpaid_sales_requires_authentication(): void
    {
        $this->getJson("/api/clients/{$this->client->id}/unpaid-sales")->assertUnauthorized();
    }

    public function test_unpaid_sales_lists_oldest_first_with_remaining_balance(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/clients/{$this->client->id}/unpaid-sales");

        $response->assertOk();
        $rows = $response->json('sales');

        $this->assertCount(2, $rows);
        $this->assertSame($this->saleA->id, $rows[0]['id']);
        $this->assertSame($this->saleB->id, $rows[1]['id']);
        $this->assertEquals(600.00, $rows[0]['remaining']);
        $this->assertEquals(400.00, $rows[1]['remaining']);
    }

    public function test_unpaid_sales_excludes_cancelled_sales(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        Sale::query()->create([
            'date' => '2026-04-08',
            'client_id' => $this->client->id,
            'total_quantity' => 1,
            'total_purchase' => 50.00,
            'total_sale' => 100.00,
            'margin' => 50.00,
            'status' => 'ANNULE',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/clients/{$this->client->id}/unpaid-sales");

        $this->assertCount(2, $response->json('sales'));
    }

    // -------------------------------------------------------------------------
    // POST /api/clients/{client}/payments
    // -------------------------------------------------------------------------

    public function test_store_requires_manage_sale_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view sales']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload())
            ->assertForbidden();
    }

    public function test_store_creates_one_transaction_and_splits_across_sales(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload());

        $response->assertCreated();

        $paymentId = $response->json('id');
        $payment = Payment::find($paymentId);

        $this->assertNotNull($payment);
        $this->assertNull($payment->sale_id, 'Multi-sale payments must not set sale_id');
        $this->assertSame($this->client->id, $payment->client_id);
        $this->assertEquals(2, SalePaymentAllocation::where('payment_id', $payment->id)->count());

        $this->assertDatabaseHas('transactions', [
            'id' => $payment->transaction_id,
            'type' => 'income',
            'category' => 'Produit',
            'amount' => 700.00,
        ]);

        $this->assertDatabaseHas('sale_payment_allocations', [
            'payment_id' => $payment->id,
            'sale_id' => $this->saleA->id,
            'amount' => 600.00,
        ]);
        $this->assertDatabaseHas('sale_payment_allocations', [
            'payment_id' => $payment->id,
            'sale_id' => $this->saleB->id,
            'amount' => 100.00,
        ]);
    }

    public function test_store_updates_payment_status_of_each_affected_sale(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload());

        $this->assertDatabaseHas('sales', ['id' => $this->saleA->id, 'payment_status' => 'PAYE']);
        $this->assertDatabaseHas('sales', ['id' => $this->saleB->id, 'payment_status' => 'PARTIEL']);
    }

    public function test_store_rejects_when_allocations_do_not_match_amount(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = $this->validPayload();
        $payload['allocations'][0]['amount'] = 100.00; // sum no longer equals `amount`

        $this->postJson("/api/clients/{$this->client->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_store_rejects_sale_belonging_to_another_client(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $otherClient = Client::query()->create(['name' => 'Autre']);
        $otherSale = Sale::query()->create([
            'date' => '2026-04-01',
            'client_id' => $otherClient->id,
            'total_quantity' => 1,
            'total_purchase' => 50.00,
            'total_sale' => 100.00,
            'margin' => 50.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $payload = [
            'amount' => 100.00,
            'method' => 'Espèces',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'allocations' => [
                ['sale_id' => $otherSale->id, 'amount' => 100.00],
            ],
        ];

        $this->postJson("/api/clients/{$this->client->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);
    }

    public function test_store_rejects_allocation_exceeding_sale_balance(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = [
            'amount' => 1000.00,
            'method' => 'Espèces',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'allocations' => [
                ['sale_id' => $this->saleA->id, 'amount' => 1000.00],
            ],
        ];

        $this->postJson("/api/clients/{$this->client->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/clients/{client}/payments/{payment}
    // -------------------------------------------------------------------------

    public function test_destroy_removes_transaction_and_reverts_all_affected_sales(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');
        $payment = Payment::find($paymentId);
        $transactionId = $payment->transaction_id;

        $this->deleteJson("/api/clients/{$this->client->id}/payments/{$paymentId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('payments', ['id' => $paymentId]);
        $this->assertDatabaseMissing('transactions', ['id' => $transactionId]);
        $this->assertDatabaseMissing('sale_payment_allocations', ['payment_id' => $paymentId]);

        $this->assertDatabaseHas('sales', ['id' => $this->saleA->id, 'payment_status' => 'NON PAYE']);
        $this->assertDatabaseHas('sales', ['id' => $this->saleB->id, 'payment_status' => 'NON PAYE']);
    }

    public function test_sale_payments_panel_shows_multi_flag_and_refuses_deletion_there(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');

        $panel = $this->getJson("/api/sales/{$this->saleA->id}/payments");
        $panel->assertOk();
        $rows = $panel->json('payments');
        $this->assertCount(1, $rows);
        $this->assertTrue($rows[0]['multi']);
        $this->assertEquals(600.00, $rows[0]['amount'], 'Row must show only the portion allocated to this sale');

        $this->deleteJson("/api/sales/{$this->saleA->id}/payments/{$paymentId}")
            ->assertStatus(422);
    }

    // -------------------------------------------------------------------------
    // GET /api/sale-payments/{payment}
    // -------------------------------------------------------------------------

    public function test_show_returns_every_sale_covered_by_a_multi_sale_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/clients/{$this->client->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');

        $detail = $this->getJson("/api/sale-payments/{$paymentId}");

        $detail->assertOk()
            ->assertJsonPath('id', $paymentId)
            ->assertJsonPath('amount', 700)
            ->assertJsonPath('client.id', $this->client->id)
            ->assertJsonCount(2, 'sales');

        $sales = collect($detail->json('sales'))->keyBy('id');

        $this->assertEquals(600.00, $sales[$this->saleA->id]['allocated_amount']);
        $this->assertEquals('PAYE', $sales[$this->saleA->id]['payment_status']);
        $this->assertEquals(100.00, $sales[$this->saleB->id]['allocated_amount']);
        $this->assertEquals('PARTIEL', $sales[$this->saleB->id]['payment_status']);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validPayload(): array
    {
        return [
            'amount' => 700.00,
            'method' => 'Espèces',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'reference' => 'REF-MULTI',
            'notes' => null,
            'allocations' => [
                ['sale_id' => $this->saleA->id, 'amount' => 600.00],
                ['sale_id' => $this->saleB->id, 'amount' => 100.00],
            ],
        ];
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

    // -------------------------------------------------------------------------
    // Table setup (SQLite in-memory fallback — no-op against migrated MySQL)
    // -------------------------------------------------------------------------

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
        $this->ensureClientsTable();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensureSalesTable();
        $this->ensurePaymentsTable();
        $this->ensureSalePaymentAllocationsTable();
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

    private function ensureClientsTable(): void
    {
        if (Schema::hasTable('clients')) {
            return;
        }
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->unsignedBigInteger('city_id')->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->decimal('credit_limit', 12, 2)->default(0);
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->integer('payment_terms_days')->nullable();
            $table->string('default_payment_method')->nullable();
            $table->timestamps();
        });
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
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->unsignedBigInteger('transfer_id')->nullable();
            $table->timestamps();
        });
    }

    private function ensureSalesTable(): void
    {
        if (Schema::hasTable('sales')) {
            return;
        }
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->date('date')->nullable();
            $table->boolean('with_invoice')->default(false);
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_purchase', 12, 2)->default(0);
            $table->decimal('total_sale', 12, 2)->default(0);
            $table->decimal('margin', 12, 2)->default(0);
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('payment_method')->nullable();
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePaymentsTable(): void
    {
        if (Schema::hasTable('payments')) {
            return;
        }
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_id')->nullable();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date')->nullable();
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    private function ensureSalePaymentAllocationsTable(): void
    {
        if (Schema::hasTable('sale_payment_allocations')) {
            return;
        }
        Schema::create('sale_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('payment_id');
            $table->unsignedBigInteger('sale_id');
            $table->decimal('amount', 10, 2);
            $table->timestamps();
        });
    }
}
