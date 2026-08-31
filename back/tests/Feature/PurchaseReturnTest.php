<?php

namespace Tests\Feature;

use App\Domain\Purchases\PurchasePaymentService;
use App\Domain\Purchases\PurchaseReturnService;
use App\Models\Account;
use App\Models\Brand;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\PurchaseReturn;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PurchaseReturnTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Account $account;

    private Supplier $supplier;

    private Product $product;

    private Stock $stock;

    private Purchase $purchase;

    private PurchaseItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view purchases', 'create purchases', 'edit purchases', 'delete purchases', 'cancel purchases'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        Role::findOrCreate('Commercial', 'web');
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

        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);

        $this->supplier = Supplier::query()->create([
            'name' => 'Fournisseur Test',
            'user_id' => $this->user->id,
        ]);

        $this->product = Product::query()->create([
            'reference' => 'REF-TEST-'.fake()->unique()->numerify('###'),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);

        DB::table('product_tyres')->insert([
            'product_id' => $this->product->id,
            'tire_width' => 205,
            'tire_height' => 55,
            'tire_diameter' => 16,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->stock = Stock::query()->create([
            'product_id' => $this->product->id,
            'quantity' => 10,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);

        // 10 units at 100 DH = 1000 DH, status RECU so the purchase already holds stock.
        $this->purchase = Purchase::query()->create([
            'date' => '2026-04-01',
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 10,
            'total_price' => 1000.00,
            'discount' => 0,
            'net_amount' => 1000.00,
            'status' => 'RECU',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $this->item = PurchaseItem::query()->create([
            'purchase_id' => $this->purchase->id,
            'product_id' => $this->product->id,
            'stock_id' => $this->stock->id,
            'quantity' => 10,
            'unit_price' => 100.00,
        ]);
    }

    // -------------------------------------------------------------------------
    // POST /api/purchases/{purchase}/returns
    // -------------------------------------------------------------------------

    public function test_store_requires_authentication(): void
    {
        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload())
            ->assertUnauthorized();
    }

    public function test_store_requires_cancel_purchases_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view purchases', 'edit purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload())
            ->assertForbidden();
    }

    public function test_partial_return_decrements_stock_and_records_movement(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 4]));

        $response->assertCreated();

        $this->stock->refresh();
        $this->assertEquals(6, $this->stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $this->stock->id,
            'type' => StockMovement::TYPE_PURCHASE_OUT,
            'quantity_before' => 10,
            'quantity_after' => 6,
        ]);

        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'status' => 'RECU',
            'returned_quantity' => 4,
            'returned_amount' => 400.00,
        ]);
    }

    public function test_returning_every_remaining_unit_cancels_the_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 10]))
            ->assertCreated();

        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'status' => 'ANNULE',
            'returned_quantity' => 10,
        ]);
    }

    public function test_return_exceeding_remaining_quantity_is_rejected(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 4]))
            ->assertCreated();

        // 4 already returned, 6 remain — asking for 7 must fail.
        $response = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 7]));

        $response->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->stock->refresh();
        $this->assertEquals(6, $this->stock->quantity, 'the rejected request must not touch stock');
    }

    public function test_return_on_already_annule_purchase_is_rejected(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->purchase->update(['status' => 'ANNULE']);

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 2]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['purchase']);
    }

    public function test_insufficient_stock_blocks_the_return_with_no_side_effects(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        // Simulate 8 of the 10 units already sold off — only 2 left physically.
        $this->stock->update(['quantity' => 2]);

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 5]));

        $response->assertUnprocessable()->assertJsonValidationErrors(['items']);
        $this->assertStringContainsString('Stock insuffisant', $response->json('errors.items.0'));

        $this->assertDatabaseMissing('purchase_returns', ['purchase_id' => $this->purchase->id]);
        $this->stock->refresh();
        $this->assertEquals(2, $this->stock->quantity);
        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'returned_quantity' => 0]);
    }

    public function test_refund_creates_income_transaction_on_chosen_account(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->payFull();

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload([
            'quantity' => 4,
            'refund' => [
                'amount' => 400.00,
                'account_id' => $this->account->id,
                'date' => '2026-04-20',
                'method' => 'Espèces',
            ],
        ]));

        $response->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'type' => 'income',
            'category' => 'Remboursement fournisseur',
            'amount' => 400.00,
            'account_id' => $this->account->id,
        ]);

        $return = $response->json();
        $this->assertNotNull($return['refund_transaction_id']);

        // -1000 (original payment, expense) + 400 (refund, income) = -600.
        $this->assertEquals(-600.00, round((float) $this->account->fresh()->current_balance, 2));
    }

    public function test_return_without_refund_creates_no_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $before = Transaction::count();

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 4]))
            ->assertCreated();

        $this->assertEquals($before, Transaction::count());
    }

    public function test_refund_exceeding_paid_minus_already_refunded_is_rejected(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->payFull(); // 1000 paid

        $response = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload([
            'quantity' => 4,
            'refund' => [
                'amount' => 1500.00,
                'account_id' => $this->account->id,
                'date' => '2026-04-20',
                'method' => 'Espèces',
            ],
        ]));

        $response->assertUnprocessable()->assertJsonValidationErrors(['refund']);
    }

    public function test_payment_status_recalculated_on_effective_amount(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->payFull(); // 1000 paid on a 1000 purchase -> PAYE

        // Return 400 DH worth, refund all of it -> effective amount 600, net paid 600 -> still PAYE.
        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload([
            'quantity' => 4,
            'refund' => [
                'amount' => 400.00,
                'account_id' => $this->account->id,
                'date' => '2026-04-20',
                'method' => 'Espèces',
            ],
        ]))->assertCreated();

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'payment_status' => 'PAYE']);
    }

    public function test_update_on_purchase_with_returns_is_rejected(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 2]))
            ->assertCreated();

        $response = $this->putJson("/api/purchases/{$this->purchase->id}", [
            'date' => '2026-04-01',
            'supplier_id' => $this->supplier->id,
            'commercial_id' => $this->user->id,
            'status' => 'RECU',
            'payment_status' => 'NON PAYE',
            'items' => [[
                'product_id' => $this->product->id,
                'stock_id' => $this->stock->id,
                'quantity' => 8,
                'unit_price' => 100.00,
            ]],
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors(['items']);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/purchase-returns/{purchaseReturn}
    // -------------------------------------------------------------------------

    public function test_destroy_restores_stock_and_reopens_purchase(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $createResponse = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 10]));
        $returnId = $createResponse->json('id');

        $this->assertDatabaseHas('purchases', ['id' => $this->purchase->id, 'status' => 'ANNULE']);

        $this->deleteJson("/api/purchase-returns/{$returnId}")->assertNoContent();

        $this->stock->refresh();
        $this->assertEquals(10, $this->stock->quantity);
        $this->assertDatabaseHas('purchases', [
            'id' => $this->purchase->id,
            'status' => 'RECU',
            'returned_quantity' => 0,
            'returned_amount' => 0,
        ]);
    }

    public function test_destroy_deletes_the_refund_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->payFull();

        $createResponse = $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload([
            'quantity' => 4,
            'refund' => [
                'amount' => 400.00,
                'account_id' => $this->account->id,
                'date' => '2026-04-20',
                'method' => 'Espèces',
            ],
        ]));
        $returnId = $createResponse->json('id');
        $refundTransactionId = $createResponse->json('refund_transaction_id');

        $this->deleteJson("/api/purchase-returns/{$returnId}")->assertNoContent();

        $this->assertDatabaseMissing('transactions', ['id' => $refundTransactionId]);
    }

    public function test_destroy_requires_cancel_purchases_permission(): void
    {
        // Created directly through the service (no prior authenticated request):
        // Sanctum::actingAs() memoizes the first user resolved on the 'sanctum'
        // guard for the rest of the test, so a second actingAs() call would not
        // actually switch identity for a subsequent HTTP call — every other
        // permission test in this codebase avoids two actingAs() calls per test
        // for the same reason.
        $return = $this->createReturn(2);

        $guest = $this->createUserWithPermissions(['view purchases', 'edit purchases']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/purchase-returns/{$return->id}")->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Non-regression: PurchaseService must not double-count already-returned stock
    // -------------------------------------------------------------------------

    public function test_cancelling_a_partially_returned_purchase_only_restores_remaining_stock(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        // Return 4 of 10 (stock: 10 -> 6), 6 remain on the line.
        $this->postJson("/api/purchases/{$this->purchase->id}/returns", $this->validPayload(['quantity' => 4]))
            ->assertCreated();

        // Cancelling the purchase from RECU (admin bypasses the transition guard)
        // must only pull back the 6 units still actually held, not all 10.
        $this->patchJson("/api/purchases/{$this->purchase->id}/status", ['status' => 'ANNULE'])
            ->assertOk();

        $this->stock->refresh();
        $this->assertEquals(0, $this->stock->quantity);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validPayload(array $overrides = []): array
    {
        $quantity = $overrides['quantity'] ?? 2;
        unset($overrides['quantity']);

        return array_merge([
            'date' => '2026-04-15',
            'reason' => 'Client désisté',
            'items' => [[
                'purchase_item_id' => $this->item->id,
                'quantity' => $quantity,
            ]],
        ], $overrides);
    }

    private function createReturn(int $quantity = 2): PurchaseReturn
    {
        return app(PurchaseReturnService::class)->create(
            $this->purchase,
            [
                'date' => '2026-04-15',
                'reason' => 'Client désisté',
                'items' => [['purchase_item_id' => $this->item->id, 'quantity' => $quantity]],
            ],
            $this->user,
        );
    }

    private function payFull(): PurchasePayment
    {
        $transaction = Transaction::query()->create([
            'date' => '2026-04-10',
            'amount' => 1000.00,
            'type' => 'expense',
            'category' => 'Achat marchandise',
            'method' => 'Espèces',
            'description' => 'Paiement achat test',
            'person' => $this->supplier->name,
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        $payment = PurchasePayment::query()->create([
            'purchase_id' => $this->purchase->id,
            'supplier_id' => $this->purchase->supplier_id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => 1000.00,
            'date' => '2026-04-10',
            'method' => 'Espèces',
        ]);

        PurchasePaymentAllocation::query()->create([
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $this->purchase->id,
            'amount' => 1000.00,
        ]);

        app(PurchasePaymentService::class)->refreshPaymentStatus($this->purchase->fresh());
        $this->purchase->refresh();

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
    // Table setup (mirrors the other Purchase* feature tests)
    // -------------------------------------------------------------------------

    private function ensureTablesExist(): void
    {
        $this->ensureUsersTable();
        $this->ensurePersonalAccessTokensTable();
        $this->ensurePermissionTables();
        $this->ensureSuppliersTable();
        $this->ensureBrandsTable();
        $this->ensureProductsTable();
        $this->ensureProductSubtypeTables();
        $this->ensureStocksTable();
        $this->ensureStockMovementsTable();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensurePurchasesTable();
        $this->ensurePurchaseItemsTable();
        $this->ensurePurchasePaymentsTable();
        $this->ensurePurchasePaymentAllocationsTable();
        $this->ensurePurchaseReturnsTable();
        $this->ensurePurchaseReturnItemsTable();
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

    private function ensureProductSubtypeTables(): void
    {
        if (! Schema::hasTable('product_tyres')) {
            Schema::create('product_tyres', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->integer('tire_width')->nullable();
                $table->integer('tire_height')->nullable();
                $table->integer('tire_diameter')->nullable();
                $table->timestamps();
            });
        }
    }

    private function ensureStocksTable(): void
    {
        if (Schema::hasTable('stocks')) {
            return;
        }
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('made_in')->nullable();
            $table->string('dot')->nullable();
            $table->string('depot')->nullable();
            $table->string('zone')->nullable();
            $table->integer('quantity')->default(0);
            $table->decimal('purchase_price', 12, 2)->default(0);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }

    private function ensureStockMovementsTable(): void
    {
        if (Schema::hasTable('stock_movements')) {
            return;
        }
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('stock_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('type');
            $table->integer('quantity_before')->default(0);
            $table->integer('quantity_after')->default(0);
            $table->integer('delta')->default(0);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reason')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
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
            $table->string('bl_number', 100)->nullable();
            $table->string('invoice_number', 100)->nullable();
            $table->decimal('discount', 5, 2)->default(0);
            $table->integer('total_quantity')->default(0);
            $table->integer('returned_quantity')->default(0);
            $table->decimal('total_price', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->decimal('returned_amount', 10, 2)->default(0);
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

    private function ensurePurchaseItemsTable(): void
    {
        if (Schema::hasTable('purchase_items')) {
            return;
        }
        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('stock_id')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2)->default(0);
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

    private function ensurePurchaseReturnsTable(): void
    {
        if (Schema::hasTable('purchase_returns')) {
            return;
        }
        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id');
            $table->date('date');
            $table->text('reason')->nullable();
            $table->integer('total_quantity');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('refund_amount', 10, 2)->default(0);
            $table->unsignedBigInteger('refund_transaction_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensurePurchaseReturnItemsTable(): void
    {
        if (Schema::hasTable('purchase_return_items')) {
            return;
        }
        Schema::create('purchase_return_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_return_id');
            $table->unsignedBigInteger('purchase_item_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('stock_id')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->timestamps();
        });
    }
}
