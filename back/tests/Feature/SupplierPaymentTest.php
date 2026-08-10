<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Supplier;
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

class SupplierPaymentTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Account $account;

    private Supplier $supplier;

    private Purchase $purchaseA;

    private Purchase $purchaseB;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view purchases', 'manage purchase-payments', 'view suppliers'] as $perm) {
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
            'name' => 'Caisse Test',
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $this->supplier = Supplier::query()->create([
            'name' => 'Fournisseur Multi',
            'user_id' => $this->user->id,
        ]);

        $this->purchaseA = Purchase::query()->create([
            'date' => '2026-04-01',
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 4,
            'total_price' => 600.00,
            'net_amount' => 600.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $this->purchaseB = Purchase::query()->create([
            'date' => '2026-04-05',
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 2,
            'total_price' => 400.00,
            'net_amount' => 400.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/suppliers/{supplier}/unpaid-purchases
    // -------------------------------------------------------------------------

    public function test_unpaid_purchases_requires_authentication(): void
    {
        $this->getJson("/api/suppliers/{$this->supplier->id}/unpaid-purchases")->assertUnauthorized();
    }

    public function test_unpaid_purchases_lists_oldest_first_with_remaining_balance(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/suppliers/{$this->supplier->id}/unpaid-purchases");

        $response->assertOk();
        $rows = $response->json('purchases');

        $this->assertCount(2, $rows);
        $this->assertSame($this->purchaseA->id, $rows[0]['id']);
        $this->assertSame($this->purchaseB->id, $rows[1]['id']);
        $this->assertEquals(600.00, $rows[0]['remaining']);
        $this->assertEquals(400.00, $rows[1]['remaining']);
    }

    public function test_unpaid_purchases_excludes_cancelled_purchases(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        Purchase::query()->create([
            'date' => '2026-04-08',
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 1,
            'total_price' => 100.00,
            'net_amount' => 100.00,
            'status' => 'ANNULE',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson("/api/suppliers/{$this->supplier->id}/unpaid-purchases");

        $this->assertCount(2, $response->json('purchases'));
    }

    // -------------------------------------------------------------------------
    // POST /api/suppliers/{supplier}/payments
    // -------------------------------------------------------------------------

    public function test_store_requires_manage_purchase_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload())
            ->assertForbidden();
    }

    public function test_store_creates_one_transaction_and_splits_across_purchases(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload());

        $response->assertCreated();

        $paymentId = $response->json('id');
        $payment = PurchasePayment::find($paymentId);

        $this->assertNotNull($payment);
        $this->assertNull($payment->purchase_id, 'Multi-purchase payments must not set purchase_id');
        $this->assertSame($this->supplier->id, $payment->supplier_id);
        $this->assertEquals(2, PurchasePaymentAllocation::where('purchase_payment_id', $payment->id)->count());

        $this->assertDatabaseHas('transactions', [
            'id' => $payment->transaction_id,
            'type' => 'expense',
            'category' => 'Achat marchandise',
            'amount' => 700.00,
        ]);

        $this->assertDatabaseHas('purchase_payment_allocations', [
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $this->purchaseA->id,
            'amount' => 600.00,
        ]);
        $this->assertDatabaseHas('purchase_payment_allocations', [
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $this->purchaseB->id,
            'amount' => 100.00,
        ]);
    }

    public function test_store_updates_payment_status_of_each_affected_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload());

        $this->assertDatabaseHas('purchases', ['id' => $this->purchaseA->id, 'payment_status' => 'PAYE']);
        $this->assertDatabaseHas('purchases', ['id' => $this->purchaseB->id, 'payment_status' => 'PARTIEL']);
    }

    public function test_store_rejects_when_allocations_do_not_match_amount(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = $this->validPayload();
        $payload['allocations'][0]['amount'] = 100.00; // sum no longer equals `amount`

        $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_store_rejects_purchase_belonging_to_another_supplier(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $otherSupplier = Supplier::query()->create(['name' => 'Autre', 'user_id' => $this->user->id]);
        $otherPurchase = Purchase::query()->create([
            'date' => '2026-04-01',
            'supplier_id' => $otherSupplier->id,
            'total_quantity' => 1,
            'total_price' => 100.00,
            'net_amount' => 100.00,
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
                ['purchase_id' => $otherPurchase->id, 'amount' => 100.00],
            ],
        ];

        $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);
    }

    public function test_store_rejects_allocation_exceeding_purchase_balance(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = [
            'amount' => 1000.00,
            'method' => 'Espèces',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'allocations' => [
                ['purchase_id' => $this->purchaseA->id, 'amount' => 1000.00],
            ],
        ];

        $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations']);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/suppliers/{supplier}/payments/{payment}
    // -------------------------------------------------------------------------

    public function test_destroy_removes_transaction_and_reverts_all_affected_purchases(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');
        $payment = PurchasePayment::find($paymentId);
        $transactionId = $payment->transaction_id;

        $this->deleteJson("/api/suppliers/{$this->supplier->id}/payments/{$paymentId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('purchase_payments', ['id' => $paymentId]);
        $this->assertDatabaseMissing('transactions', ['id' => $transactionId]);
        $this->assertDatabaseMissing('purchase_payment_allocations', ['purchase_payment_id' => $paymentId]);

        $this->assertDatabaseHas('purchases', ['id' => $this->purchaseA->id, 'payment_status' => 'NON PAYE']);
        $this->assertDatabaseHas('purchases', ['id' => $this->purchaseB->id, 'payment_status' => 'NON PAYE']);

        $logA = ActivityLog::where('entity_type', ActivityLog::ENTITY_ACHAT)->where('entity_id', $this->purchaseA->id)
            ->where('action', ActivityLog::ACTION_PAYMENT_DELETE)->latest('id')->first();
        $logB = ActivityLog::where('entity_type', ActivityLog::ENTITY_ACHAT)->where('entity_id', $this->purchaseB->id)
            ->where('action', ActivityLog::ACTION_PAYMENT_DELETE)->latest('id')->first();

        $this->assertEquals(600.00, $logA->properties['amount'], 'Log for purchase A must show only its allocated portion, not the full multi-purchase payment');
        $this->assertEquals(100.00, $logB->properties['amount'], 'Log for purchase B must show only its allocated portion, not the full multi-purchase payment');
    }

    public function test_purchase_payments_panel_shows_multi_flag_and_refuses_deletion_there(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');

        $panel = $this->getJson("/api/purchases/{$this->purchaseA->id}/payments");
        $panel->assertOk();
        $rows = $panel->json('payments');
        $this->assertCount(1, $rows);
        $this->assertTrue($rows[0]['multi']);
        $this->assertEquals(600.00, $rows[0]['amount'], 'Row must show only the portion allocated to this purchase');

        $this->deleteJson("/api/purchases/{$this->purchaseA->id}/payments/{$paymentId}")
            ->assertStatus(422);
    }

    // -------------------------------------------------------------------------
    // GET /api/purchase-payments/{payment}
    // -------------------------------------------------------------------------

    public function test_show_returns_every_purchase_covered_by_a_multi_purchase_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/suppliers/{$this->supplier->id}/payments", $this->validPayload());
        $paymentId = $response->json('id');

        $detail = $this->getJson("/api/purchase-payments/{$paymentId}");

        $detail->assertOk()
            ->assertJsonPath('id', $paymentId)
            ->assertJsonPath('amount', 700)
            ->assertJsonPath('supplier.id', $this->supplier->id)
            ->assertJsonCount(2, 'purchases');

        $purchases = collect($detail->json('purchases'))->keyBy('id');

        $this->assertEquals(600.00, $purchases[$this->purchaseA->id]['allocated_amount']);
        $this->assertEquals('PAYE', $purchases[$this->purchaseA->id]['payment_status']);
        $this->assertEquals(100.00, $purchases[$this->purchaseB->id]['allocated_amount']);
        $this->assertEquals('PARTIEL', $purchases[$this->purchaseB->id]['payment_status']);
    }

    // -------------------------------------------------------------------------
    // GET /api/suppliers/{supplier}/statement
    // -------------------------------------------------------------------------

    public function test_statement_orders_entries_by_date_descending(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/suppliers/{$this->supplier->id}/statement");

        $response->assertOk();
        $dates = collect($response->json('entries'))->pluck('date')->all();

        $this->assertSame($dates, collect($dates)->sortDesc()->values()->all(), 'Entries must be ordered newest first.');
        $this->assertSame($this->purchaseB->date->toDateString(), $dates[0]);
        $this->assertSame($this->purchaseA->date->toDateString(), $dates[count($dates) - 1]);
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
                ['purchase_id' => $this->purchaseA->id, 'amount' => 600.00],
                ['purchase_id' => $this->purchaseB->id, 'amount' => 100.00],
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
        $this->ensureSuppliersTable();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensurePurchasesTable();
        $this->ensurePurchasePaymentsTable();
        $this->ensurePurchasePaymentAllocationsTable();
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

    private function ensureSuppliersTable(): void
    {
        if (Schema::hasTable('suppliers')) {
            return;
        }
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact_person')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->unsignedBigInteger('user_id');
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

    private function ensurePurchasesTable(): void
    {
        if (Schema::hasTable('purchases')) {
            return;
        }
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->boolean('with_invoice')->default(false);
            $table->integer('total_quantity')->default(0);
            $table->decimal('total_price', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->unsignedBigInteger('supplier_id');
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->default('EN COURS');
            $table->string('payment_status')->default('NON PAYE');
            $table->date('payment_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePurchasePaymentsTable(): void
    {
        if (Schema::hasTable('purchase_payments')) {
            return;
        }
        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->date('date');
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
        });
    }

    private function ensurePurchasePaymentAllocationsTable(): void
    {
        if (Schema::hasTable('purchase_payment_allocations')) {
            return;
        }
        Schema::create('purchase_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_payment_id');
            $table->unsignedBigInteger('purchase_id');
            $table->decimal('amount', 10, 2);
            $table->timestamps();
        });
    }
}
