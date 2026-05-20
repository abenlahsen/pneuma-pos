<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\Supplier;
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

class PurchasePaymentTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Account $account;
    private Purchase $purchase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view purchases', 'manage purchase-payments'] as $perm) {
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

        $supplier = Supplier::query()->create([
            'name' => 'Fournisseur Test',
            'user_id' => $this->user->id,
        ]);

        $this->purchase = Purchase::query()->create([
            'date' => '2026-04-01',
            'supplier_id' => $supplier->id,
            'total_quantity' => 4,
            'total_price' => 1000.00,
            'discount' => 0,
            'net_amount' => 1000.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/purchases/{purchase}/payments
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $response = $this->getJson("/api/purchases/{$this->purchase->id}/payments");

        $response->assertUnauthorized();
    }

    public function test_index_requires_view_purchases_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->getJson("/api/purchases/{$this->purchase->id}/payments");

        $response->assertForbidden();
    }

    public function test_index_returns_payment_summary(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $transaction = Transaction::query()->create([
            'date' => '2026-04-10',
            'amount' => 300.00,
            'type' => 'expense',
            'category' => 'Achat',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        PurchasePayment::query()->create([
            'purchase_id' => $this->purchase->id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => 300.00,
            'date' => '2026-04-10',
            'method' => 'Espèces',
        ]);

        $response = $this->getJson("/api/purchases/{$this->purchase->id}/payments");

        $response->assertOk()
            ->assertJsonPath('total_paid', 300)
            ->assertJsonPath('total_purchase', 1000)
            ->assertJsonPath('remaining', 700)
            ->assertJsonPath('payment_status', 'NON PAYE')
            ->assertJsonCount(1, 'payments');
    }

    // -------------------------------------------------------------------------
    // POST /api/purchases/{purchase}/payments
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", []);

        $response->assertUnauthorized();
    }

    public function test_store_requires_manage_purchase_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", $this->validPayload());

        $response->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'method', 'date', 'account_id']);
    }

    public function test_store_validates_account_must_exist(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['account_id' => 99999]
        ));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['account_id']);
    }

    public function test_store_validates_amount_must_be_positive(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 0]
        ));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_store_creates_payment_and_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/payments", $this->validPayload());

        $response->assertCreated();

        $this->assertDatabaseHas('purchase_payments', [
            'purchase_id' => $this->purchase->id,
            'amount' => 400.00,
            'method' => 'Espèces',
        ]);

        $paymentId = $response->json('id');
        $payment = PurchasePayment::find($paymentId);
        $this->assertNotNull($payment->transaction_id, 'Payment must be linked to a transaction');

        $this->assertDatabaseHas('transactions', [
            'id' => $payment->transaction_id,
            'type' => 'expense',
            'category' => 'Achat',
            'amount' => 400.00,
            'account_id' => $this->account->id,
        ]);
    }

    public function test_store_sets_payment_status_to_partiel_on_partial_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 400.00]
        ));

        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'payment_status' => 'PARTIEL',
        ]);
    }

    public function test_store_sets_payment_status_to_paye_on_full_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 1000.00]
        ));

        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'payment_status' => 'PAYE',
        ]);
    }

    public function test_store_sets_payment_status_to_paye_when_cumulative_payments_cover_total(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 600.00]
        ));

        $this->postJson("/api/purchases/{$this->purchase->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 400.00]
        ));

        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'payment_status' => 'PAYE',
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/purchases/{purchase}/payments/{payment}
    // -------------------------------------------------------------------------

    public function test_destroy_requires_manage_purchase_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $payment = $this->createPayment();

        $response = $this->deleteJson("/api/purchases/{$this->purchase->id}/payments/{$payment->id}");

        $response->assertForbidden();
    }

    public function test_destroy_deletes_payment_and_its_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payment = $this->createPayment(500.00);
        $transactionId = $payment->transaction_id;

        $response = $this->deleteJson("/api/purchases/{$this->purchase->id}/payments/{$payment->id}");

        $response->assertNoContent();

        $this->assertDatabaseMissing('purchase_payments', ['id' => $payment->id]);
        $this->assertDatabaseMissing('transactions', ['id' => $transactionId]);
    }

    public function test_destroy_returns_404_for_payment_on_wrong_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $otherSupplier = Supplier::query()->create([
            'name' => 'Autre Fournisseur',
            'user_id' => $this->user->id,
        ]);
        $otherPurchase = Purchase::query()->create([
            'date' => '2026-04-01',
            'supplier_id' => $otherSupplier->id,
            'total_quantity' => 2,
            'total_price' => 500.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $payment = $this->createPayment(200.00);

        $response = $this->deleteJson("/api/purchases/{$otherPurchase->id}/payments/{$payment->id}");

        $response->assertNotFound();
    }

    public function test_destroy_reverts_payment_status_to_non_paye_after_last_payment_deleted(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payment = $this->createPayment(1000.00);

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'payment_status' => 'PAYE']);

        $this->deleteJson("/api/purchases/{$this->purchase->id}/payments/{$payment->id}");

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'payment_status' => 'NON PAYE']);
    }

    public function test_destroy_reverts_payment_status_to_partiel_when_partial_remains(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $first = $this->createPayment(600.00);
        $second = $this->createPayment(400.00);

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'payment_status' => 'PAYE']);

        $this->deleteJson("/api/purchases/{$this->purchase->id}/payments/{$second->id}");

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'payment_status' => 'PARTIEL']);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validPayload(): array
    {
        return [
            'amount' => 400.00,
            'method' => 'Espèces',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'reference' => 'REF-001',
            'notes' => null,
        ];
    }

    private function createPayment(float $amount = 400.00): PurchasePayment
    {
        $transaction = Transaction::query()->create([
            'date' => '2026-04-15',
            'amount' => $amount,
            'type' => 'expense',
            'category' => 'Achat',
            'method' => 'Espèces',
            'description' => "Paiement achat #{$this->purchase->id}",
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        $payment = PurchasePayment::query()->create([
            'purchase_id' => $this->purchase->id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => $amount,
            'date' => '2026-04-15',
            'method' => 'Espèces',
        ]);

        // Refresh payment status on the purchase
        app(\App\Domain\Purchases\PurchasePaymentService::class)
            ->refreshPaymentStatus($this->purchase->fresh());

        return $payment;
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
    // Table setup (SQLite in-memory)
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
            $table->unsignedBigInteger('supplier_id');
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->default('EN COURS');
            $table->string('payment_status')->default('NON PAYE');
            $table->string('payment_method')->nullable();
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
            $table->unsignedBigInteger('purchase_id');
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
}
