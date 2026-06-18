<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Client;
use App\Models\Product;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use App\Models\ServicePayment;
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

class ServiceOrderApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Account $account;
    private ServiceOrder $order;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTablesExist();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->product = Product::query()->create([
            'profile' => 'Vidange huile',
            'reference' => 'VID-001',
            'type' => 'service',
            'is_active' => true,
            'unit' => 'unité',
        ]);

        foreach ([
            'view service-orders', 'create service-orders', 'edit service-orders',
            'delete service-orders', 'manage service-payments',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::all());
        Role::findOrCreate('Commercial', 'web');
        Role::findOrCreate('Manager', 'web');

        $this->user = User::query()->create([
            'name' => 'Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);

        $this->account = Account::query()->create([
            'name' => 'Caisse SO ' . fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $this->order = $this->createOrder();
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders
    // -------------------------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/service-orders')->assertUnauthorized();
    }

    public function test_index_requires_view_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/service-orders')->assertForbidden();
    }

    public function test_index_returns_paginated_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders');

        $response->assertOk()
            ->assertJsonStructure(['data', 'total', 'current_page', 'last_page', 'per_page']);
    }

    public function test_index_filters_by_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $this->createOrder(['status' => 'TERMINE']);

        $response = $this->getJson('/api/service-orders?status=TERMINE');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_index_filters_by_payment_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders?payment_status=NON PAYE');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(1, $response->json('total'));
    }

    public function test_index_filters_by_commercial_id(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/service-orders?commercial_id={$this->user->id}");

        $response->assertOk();
    }

    public function test_index_filters_by_date_range(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders?date_from=2026-01-01&date_to=2026-12-31');

        $response->assertOk();
    }

    // -------------------------------------------------------------------------
    // POST /api/service-orders
    // -------------------------------------------------------------------------

    public function test_store_requires_create_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view service-orders']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson('/api/service-orders', $this->validOrderPayload())->assertForbidden();
    }

    public function test_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson('/api/service-orders', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date', 'items']);
    }

    public function test_store_validates_items_must_have_at_least_one(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = array_merge($this->validOrderPayload(), ['items' => []]);

        $this->postJson('/api/service-orders', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);
    }

    public function test_store_creates_service_order_with_items(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson('/api/service-orders', $this->validOrderPayload());

        $response->assertCreated()
            ->assertJsonPath('vehicle', 'Renault Clio')
            ->assertJsonPath('status', 'EN COURS');

        $this->assertDatabaseHas('service_orders', ['vehicle' => 'Renault Clio']);
        $this->assertDatabaseHas('service_items', ['service_type' => 'Vidange', 'item_type' => 'service']);
    }

    public function test_store_calculates_totals_correctly(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = $this->validOrderPayload();
        $payload['items'] = [
            ['item_type' => 'service', 'service_type' => 'Vidange', 'parts_cost' => 100, 'labor_cost' => 50],
            ['item_type' => 'service', 'service_type' => 'Montage', 'parts_cost' => 200, 'labor_cost' => 80],
        ];
        $payload['discount'] = 30;

        $response = $this->postJson('/api/service-orders', $payload);

        $response->assertCreated();
        $id = $response->json('id');

        $order = ServiceOrder::find($id);
        $this->assertEquals(430, (float) $order->total_amount);
        $this->assertEquals(301, (float) $order->net_amount);
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders/{id}
    // -------------------------------------------------------------------------

    public function test_show_returns_order(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/service-orders/{$this->order->id}");

        $response->assertOk()
            ->assertJsonPath('id', $this->order->id);
    }

    public function test_show_returns_404_for_unknown_order(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->getJson('/api/service-orders/99999')->assertNotFound();
    }

    // -------------------------------------------------------------------------
    // PUT /api/service-orders/{id}
    // -------------------------------------------------------------------------

    public function test_update_requires_edit_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view service-orders']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/service-orders/{$this->order->id}", ['vehicle' => 'Peugeot'])
            ->assertForbidden();
    }

    public function test_update_modifies_order(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = array_merge($this->validOrderPayload(), ['status' => 'TERMINE', 'vehicle' => 'Peugeot 208']);

        $this->putJson("/api/service-orders/{$this->order->id}", $payload)
            ->assertOk()
            ->assertJsonPath('status', 'TERMINE')
            ->assertJsonPath('vehicle', 'Peugeot 208');
    }

    public function test_update_replaces_items_when_provided(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payload = $this->validOrderPayload();
        $payload['items'] = [
            ['item_type' => 'service', 'service_type' => 'Révision', 'parts_cost' => 300, 'labor_cost' => 100],
        ];

        $response = $this->putJson("/api/service-orders/{$this->order->id}", $payload);

        $response->assertOk();
        $this->assertDatabaseHas('service_items', [
            'service_order_id' => $this->order->id,
            'service_type' => 'Révision',
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/service-orders/{id}
    // -------------------------------------------------------------------------

    public function test_destroy_requires_delete_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view service-orders']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/service-orders/{$this->order->id}")->assertForbidden();
    }

    public function test_destroy_deletes_order(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $orderId = $this->order->id;

        $this->deleteJson("/api/service-orders/{$orderId}")->assertNoContent();

        $this->assertDatabaseMissing('service_orders', ['id' => $orderId]);
    }

    public function test_destroy_also_deletes_linked_payment_transactions(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $transaction = Transaction::query()->create([
            'date' => '2026-05-01',
            'amount' => 200,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'partner' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        ServicePayment::query()->create([
            'service_order_id' => $this->order->id,
            'amount' => 200,
            'date' => '2026-05-01',
            'method' => 'Espèces',
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
        ]);

        $this->deleteJson("/api/service-orders/{$this->order->id}")->assertNoContent();

        $this->assertDatabaseMissing('transactions', ['id' => $transaction->id]);
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders-summary
    // -------------------------------------------------------------------------

    public function test_summary_returns_revenue_data(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders-summary');

        $response->assertOk()
            ->assertJsonStructure(['total_revenue', 'total_paid', 'remaining']);
    }

    public function test_summary_filters_by_status(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders-summary?status=EN COURS');

        $response->assertOk();
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders/export
    // -------------------------------------------------------------------------

    public function test_export_streams_xlsx(): void
    {
        $this->createOrder(['date' => '2026-05-10']);
        $this->createOrder(['date' => '2026-05-15']);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->get('/api/service-orders/export');

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    public function test_export_requires_authentication(): void
    {
        $this->getJson('/api/service-orders/export')->assertUnauthorized();
    }

    public function test_export_requires_view_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->get('/api/service-orders/export')->assertForbidden();
    }

    public function test_export_applies_status_filter(): void
    {
        $this->createOrder(['status' => 'EN COURS']);
        $this->createOrder(['status' => 'TERMINE']);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->get('/api/service-orders/export?status=TERMINE');

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    public function test_export_applies_date_filter(): void
    {
        $this->createOrder(['date' => '2026-01-15']);
        $this->createOrder(['date' => '2026-05-20']);

        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->get('/api/service-orders/export?date_from=2026-05-01&date_to=2026-05-31');

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders-filters
    // -------------------------------------------------------------------------

    public function test_filters_returns_filter_options(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/service-orders-filters');

        $response->assertOk()
            ->assertJsonStructure(['service_products', 'commercials', 'clients', 'accounts']);
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders/{id}/payments
    // -------------------------------------------------------------------------

    public function test_payment_index_requires_authentication(): void
    {
        $this->getJson("/api/service-orders/{$this->order->id}/payments")->assertUnauthorized();
    }

    public function test_payment_index_returns_payment_summary(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/service-orders/{$this->order->id}/payments");

        $response->assertOk()
            ->assertJsonStructure(['payments', 'total_paid', 'total_amount', 'remaining', 'payment_status']);
    }

    // -------------------------------------------------------------------------
    // POST /api/service-orders/{id}/payments
    // -------------------------------------------------------------------------

    public function test_payment_store_requires_manage_payment_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view service-orders']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson("/api/service-orders/{$this->order->id}/payments", $this->validPaymentPayload())
            ->assertForbidden();
    }

    public function test_payment_store_validates_required_fields(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson("/api/service-orders/{$this->order->id}/payments", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'date']);
    }

    public function test_payment_store_creates_payment_and_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson(
            "/api/service-orders/{$this->order->id}/payments",
            $this->validPaymentPayload()
        );

        $response->assertCreated();

        $this->assertDatabaseHas('service_payments', [
            'service_order_id' => $this->order->id,
            'amount' => 200.00,
        ]);

        $payment = ServicePayment::query()->where('service_order_id', $this->order->id)->first();
        $this->assertNotNull($payment->transaction_id);
    }

    public function test_payment_store_updates_payment_status_to_paye(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $netAmount = (float) $this->order->net_amount;
        $payload = array_merge($this->validPaymentPayload(), ['amount' => $netAmount]);

        $this->postJson("/api/service-orders/{$this->order->id}/payments", $payload);

        $this->assertDatabaseHas('service_orders', [
            'id' => $this->order->id,
            'payment_status' => 'PAYE',
        ]);
    }

    public function test_payment_store_updates_payment_status_to_partiel(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $netAmount = (float) $this->order->net_amount;
        $payload = array_merge($this->validPaymentPayload(), ['amount' => $netAmount / 2]);

        $this->postJson("/api/service-orders/{$this->order->id}/payments", $payload);

        $this->assertDatabaseHas('service_orders', [
            'id' => $this->order->id,
            'payment_status' => 'PARTIEL',
        ]);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/service-orders/{id}/payments/{payment}
    // -------------------------------------------------------------------------

    public function test_payment_destroy_deletes_payment_and_transaction(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $payment = $this->createPayment(100.00);
        $transactionId = $payment->transaction_id;

        $this->deleteJson("/api/service-orders/{$this->order->id}/payments/{$payment->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('service_payments', ['id' => $payment->id]);
        $this->assertDatabaseMissing('transactions', ['id' => $transactionId]);
    }

    public function test_payment_destroy_returns_404_for_payment_on_wrong_order(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $otherOrder = $this->createOrder();
        $payment = $this->createPayment(100.00);

        $this->deleteJson("/api/service-orders/{$otherOrder->id}/payments/{$payment->id}")
            ->assertNotFound();
    }

    public function test_payment_destroy_reverts_status_to_non_paye(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $netAmount = (float) $this->order->net_amount;
        $payment = $this->createPayment($netAmount);

        $this->assertDatabaseHas('service_orders', ['id' => $this->order->id, 'payment_status' => 'PAYE']);

        $this->deleteJson("/api/service-orders/{$this->order->id}/payments/{$payment->id}");

        $this->assertDatabaseHas('service_orders', ['id' => $this->order->id, 'payment_status' => 'NON PAYE']);
    }

    // -------------------------------------------------------------------------
    // GET /api/service-orders/{id}/items
    // -------------------------------------------------------------------------

    public function test_items_index_returns_list(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson("/api/service-orders/{$this->order->id}/items");

        $response->assertOk();
        $this->assertIsArray($response->json());
    }

    // -------------------------------------------------------------------------
    // DELETE /api/service-orders/{id}/items/{item}
    // -------------------------------------------------------------------------

    public function test_items_destroy_returns_422_when_only_one_item(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $item = $this->order->items()->first();

        $this->deleteJson("/api/service-orders/{$this->order->id}/items/{$item->id}")
            ->assertStatus(422);
    }

    public function test_items_destroy_deletes_item_when_multiple(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        // Add a second item via direct DB so we have 2 items
        ServiceItem::query()->create([
            'service_order_id' => $this->order->id,
            'item_type' => 'service',
            'service_type' => 'Extra',
            'parts_cost' => 0,
            'labor_cost' => 50,
            'line_total' => 50,
            'sort_order' => 1,
        ]);

        $item = $this->order->items()->first();

        $this->deleteJson("/api/service-orders/{$this->order->id}/items/{$item->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('service_items', ['id' => $item->id]);
    }

    // -------------------------------------------------------------------------
    // POST /api/service-orders/{id}/items/sync
    // -------------------------------------------------------------------------

    public function test_items_sync_replaces_all_items(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/service-orders/{$this->order->id}/items/sync", [
            'items' => [
                ['item_type' => 'service', 'service_type' => 'Vidange', 'parts_cost' => 400, 'labor_cost' => 50],
                ['item_type' => 'service', 'service_type' => 'Montage', 'parts_cost' => 0, 'labor_cost' => 80],
            ],
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('service_items', [
            'service_order_id' => $this->order->id,
            'service_type' => 'Vidange',
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function validOrderPayload(): array
    {
        return [
            'date' => '2026-05-01',
            'vehicle' => 'Renault Clio',
            'mileage' => 50000,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->user->id,
            'items' => [
                ['item_type' => 'service', 'service_type' => 'Vidange', 'parts_cost' => 80, 'labor_cost' => 40],
            ],
            'discount' => 0,
        ];
    }

    private function validPaymentPayload(): array
    {
        return [
            'amount' => 200.00,
            'date' => '2026-05-02',
            'method' => 'Espèces',
            'account_id' => $this->account->id,
        ];
    }

    private function createOrder(array $attributes = []): ServiceOrder
    {
        $order = ServiceOrder::query()->create(array_merge([
            'date' => '2026-05-01',
            'vehicle' => 'Renault Clio',
            'mileage' => 50000,
            'total_amount' => 200,
            'discount' => 0,
            'net_amount' => 200,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->user->id,
            'created_by' => $this->user->id,
        ], $attributes));

        ServiceItem::query()->create([
            'service_order_id' => $order->id,
            'item_type' => 'service',
            'service_type' => 'Vidange',
            'parts_cost' => 80,
            'labor_cost' => 120,
            'line_total' => 200,
            'sort_order' => 0,
        ]);

        return $order;
    }

    private function createPayment(float $amount = 100.00): ServicePayment
    {
        $transaction = Transaction::query()->create([
            'date' => '2026-05-02',
            'amount' => $amount,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'partner' => '',
            'user_id' => $this->user->id,
            'account_id' => $this->account->id,
        ]);

        $payment = ServicePayment::query()->create([
            'service_order_id' => $this->order->id,
            'amount' => $amount,
            'date' => '2026-05-02',
            'method' => 'Espèces',
            'account_id' => $this->account->id,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
        ]);

        app(\App\Domain\ServiceOrders\ServicePaymentService::class)
            ->refreshPaymentStatus($this->order->fresh());

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

        foreach ($permissions as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

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
        $this->ensureClientsTable();
        $this->ensureAccountsTable();
        $this->ensureTransactionsTable();
        $this->ensureProductsTable();
        $this->ensureProductServicesTable();
        $this->ensureServiceOrdersTable();
        $this->ensureServiceItemsTable();
        $this->ensureServicePaymentsTable();
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
                $table->primary(['permission_id', 'model_id', 'model_type'], 'so_mhp_primary');
            });
        }
        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['role_id', 'model_id', 'model_type'], 'so_mhr_primary');
            });
        }
        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->unsignedBigInteger('role_id');
                $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
                $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
                $table->primary(['permission_id', 'role_id'], 'so_rhp_primary');
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
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('city')->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('category')->nullable();
            $table->decimal('credit_limit', 12, 2)->default(0);
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->string('payment_terms')->nullable();
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
            $table->string('partner')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->unsignedBigInteger('transfer_id')->nullable();
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
            $table->string('type')->default('service');
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->text('description')->nullable();
            $table->string('unit')->default('unité');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    private function ensureProductServicesTable(): void
    {
        if (Schema::hasTable('product_services')) {
            return;
        }
        Schema::create('product_services', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->primary();
            $table->string('category')->nullable();
            $table->integer('duration_minutes')->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->timestamps();
        });
    }

    private function ensureServiceOrdersTable(): void
    {
        if (Schema::hasTable('service_orders')) {
            return;
        }
        Schema::create('service_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->date('date');
            $table->string('vehicle');
            $table->integer('mileage')->nullable();
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->string('status')->default('EN COURS');
            $table->string('payment_status')->default('NON PAYE');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('commercial_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    private function ensureServiceItemsTable(): void
    {
        if (Schema::hasTable('service_items')) {
            return;
        }
        Schema::create('service_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('service_order_id');
            $table->string('item_type')->default('service');
            $table->string('service_type')->nullable();
            $table->unsignedBigInteger('product_id')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->unsignedBigInteger('stock_id')->nullable();
            $table->text('description')->nullable();
            $table->decimal('parts_cost', 10, 2)->default(0);
            $table->decimal('labor_cost', 10, 2)->default(0);
            $table->decimal('line_total', 10, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    private function ensureServicePaymentsTable(): void
    {
        if (Schema::hasTable('service_payments')) {
            return;
        }
        Schema::create('service_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('service_order_id');
            $table->decimal('amount', 10, 2);
            $table->date('date');
            $table->string('method', 100)->nullable();
            $table->unsignedBigInteger('account_id')->nullable();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }
}
