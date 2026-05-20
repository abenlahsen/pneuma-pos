<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Payment;
use App\Models\Sale;
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

class SalePaymentTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Account $account;
    private Sale $sale;

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
            'name' => 'Caisse Test ' . fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $this->sale = Sale::query()->create([
            'date' => '2026-04-01',
            'total_quantity' => 4,
            'total_purchase' => 600.00,
            'total_sale' => 1200.00,
            'margin' => 600.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYÉ',
            'created_by' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /api/sales/{sale}/payments
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $response = $this->getJson("/api/sales/{$this->sale->id}/payments");

        $response->assertUnauthorized();
    }

    public function test_index_requires_view_sales_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->getJson("/api/sales/{$this->sale->id}/payments");

        $response->assertForbidden();
    }

    public function test_index_returns_payment_summary(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $transaction = Transaction::query()->create([
            'date' => '2026-04-10',
            'amount' => 400.00,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        Payment::query()->create([
            'sale_id' => $this->sale->id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => 400.00,
            'date' => '2026-04-10',
            'method' => 'Espèces',
        ]);

        $response = $this->getJson("/api/sales/{$this->sale->id}/payments");

        $response->assertOk()
            ->assertJsonPath('total_paid', 400)
            ->assertJsonPath('total_sale', 1200)
            ->assertJsonPath('remaining', 800)
            ->assertJsonPath('payment_status', 'NON PAYÉ')
            ->assertJsonCount(1, 'payments');
    }

    // -------------------------------------------------------------------------
    // POST /api/sales/{sale}/payments
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", []);

        $response->assertUnauthorized();
    }

    public function test_store_requires_manage_sale_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view sales']);
        Sanctum::actingAs($guest, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", $this->validPayload());

        $response->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'date', 'account_id']);
    }

    public function test_store_validates_account_must_exist(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['account_id' => 99999]
        ));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['account_id']);
    }

    public function test_store_validates_amount_must_be_positive(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 0]
        ));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_store_creates_payment_and_income_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/payments", $this->validPayload());

        $response->assertCreated();

        $this->assertDatabaseHas('payments', [
            'sale_id' => $this->sale->id,
            'amount' => 500.00,
            'method' => 'Chèque',
        ]);

        $paymentId = $response->json('id');
        $payment = Payment::find($paymentId);
        $this->assertNotNull($payment->transaction_id, 'Payment must be linked to a transaction');

        $this->assertDatabaseHas('transactions', [
            'id' => $payment->transaction_id,
            'type' => 'income',
            'category' => 'Produit',
            'amount' => 500.00,
            'account_id' => $this->account->id,
        ]);
    }

    public function test_store_sets_payment_status_to_partiel_on_partial_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 500.00]
        ));

        $this->assertDatabaseHas('sales', [
            'id' => $this->sale->id,
            'payment_status' => 'PARTIEL',
        ]);
    }

    public function test_store_sets_payment_status_to_paye_on_full_payment(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 1200.00]
        ));

        $this->assertDatabaseHas('sales', [
            'id' => $this->sale->id,
            'payment_status' => 'PAYÉ',
        ]);
    }

    public function test_store_sets_payment_status_to_paye_when_cumulative_payments_cover_total(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 700.00]
        ));

        $this->postJson("/api/sales/{$this->sale->id}/payments", array_merge(
            $this->validPayload(),
            ['amount' => 500.00]
        ));

        $this->assertDatabaseHas('sales', [
            'id' => $this->sale->id,
            'payment_status' => 'PAYÉ',
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/sales/{sale}/payments/{payment}
    // -------------------------------------------------------------------------

    public function test_destroy_requires_manage_sale_payments_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view sales']);
        Sanctum::actingAs($guest, [], 'web');

        $payment = $this->createPayment();

        $response = $this->deleteJson("/api/sales/{$this->sale->id}/payments/{$payment->id}");

        $response->assertForbidden();
    }

    public function test_destroy_deletes_payment_and_its_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payment = $this->createPayment(500.00);
        $transactionId = $payment->transaction_id;

        $response = $this->deleteJson("/api/sales/{$this->sale->id}/payments/{$payment->id}");

        $response->assertNoContent();

        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
        $this->assertDatabaseMissing('transactions', ['id' => $transactionId]);
    }

    public function test_destroy_returns_404_for_payment_on_wrong_sale(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $otherSale = Sale::query()->create([
            'date' => '2026-04-02',
            'total_quantity' => 2,
            'total_purchase' => 200.00,
            'total_sale' => 400.00,
            'margin' => 200.00,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYÉ',
            'created_by' => $this->user->id,
        ]);

        $payment = $this->createPayment(200.00);

        $response = $this->deleteJson("/api/sales/{$otherSale->id}/payments/{$payment->id}");

        $response->assertNotFound();
    }

    public function test_destroy_reverts_payment_status_to_non_paye_after_last_payment_deleted(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payment = $this->createPayment(1200.00);

        $this->assertDatabaseHas('sales', ['id' => $this->sale->id, 'payment_status' => 'PAYÉ']);

        $this->deleteJson("/api/sales/{$this->sale->id}/payments/{$payment->id}");

        $this->assertDatabaseHas('sales', ['id' => $this->sale->id, 'payment_status' => 'NON PAYÉ']);
    }

    public function test_destroy_reverts_payment_status_to_partiel_when_partial_remains(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $first = $this->createPayment(700.00);
        $second = $this->createPayment(500.00);

        $this->assertDatabaseHas('sales', ['id' => $this->sale->id, 'payment_status' => 'PAYÉ']);

        $this->deleteJson("/api/sales/{$this->sale->id}/payments/{$second->id}");

        $this->assertDatabaseHas('sales', ['id' => $this->sale->id, 'payment_status' => 'PARTIEL']);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validPayload(): array
    {
        return [
            'amount' => 500.00,
            'method' => 'Chèque',
            'date' => '2026-04-15',
            'account_id' => $this->account->id,
            'reference' => 'CHQ-001',
            'notes' => null,
        ];
    }

    private function createPayment(float $amount = 500.00): Payment
    {
        $transaction = Transaction::query()->create([
            'date' => '2026-04-15',
            'amount' => $amount,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Chèque',
            'description' => "Paiement vente #{$this->sale->id}",
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        $payment = Payment::query()->create([
            'sale_id' => $this->sale->id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => $amount,
            'date' => '2026-04-15',
            'method' => 'Chèque',
        ]);

        app(\App\Domain\Sales\SalePaymentService::class)
            ->refreshPaymentStatus($this->sale->fresh());

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
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensureBrandsTable();
        $this->ensureProductsTable();
        $this->ensureProductTyresTable();
        $this->ensureSalesTable();
        $this->ensureSaleItemsTable();
        $this->ensurePaymentsTable();
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
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->unsignedBigInteger('transfer_id')->nullable();
            $table->timestamps();
        });
    }

    private function ensureBrandsTable(): void
    {
        if (Schema::hasTable('brands')) {
            return;
        }
        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('logo')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureProductsTable(): void
    {
        if (Schema::hasTable('products')) {
            return;
        }
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('profile')->nullable();
            $table->string('reference')->nullable();
            $table->string('type')->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->text('description')->nullable();
            $table->string('unit')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureProductTyresTable(): void
    {
        if (Schema::hasTable('product_tyres')) {
            return;
        }
        Schema::create('product_tyres', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->integer('tire_width')->nullable();
            $table->integer('tire_height')->nullable();
            $table->integer('tire_diameter')->nullable();
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
            $table->unsignedBigInteger('carrier_id')->nullable();
            $table->string('tracking_number')->nullable();
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->string('service')->nullable();
            $table->decimal('service_fee', 12, 2)->default(0);
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('payment_method')->nullable();
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->string('status')->nullable();
            $table->string('payment_status')->nullable();
            $table->date('delivery_date')->nullable();
            $table->text('comments')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensureSaleItemsTable(): void
    {
        if (Schema::hasTable('sale_items')) {
            return;
        }
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sale_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('stock_id')->nullable();
            $table->integer('quantity')->default(0);
            $table->decimal('purchase_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->decimal('discount', 8, 2)->default(0);
            $table->decimal('total_purchase', 12, 2)->default(0);
            $table->decimal('total_sale', 12, 2)->default(0);
            $table->decimal('margin', 12, 2)->default(0);
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
            $table->unsignedBigInteger('sale_id');
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
}
