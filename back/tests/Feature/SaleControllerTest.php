<?php

namespace Tests\Feature;

use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Models\Account;
use App\Models\Brand;
use App\Models\Carrier;
use App\Models\Client;
use App\Models\Partner;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class SaleControllerTest extends TestCase
{
    use DatabaseTransactions;

    private $user;

    private ?Product $sharedProduct = null;

    private ?Stock $sharedStock = null;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        $this->ensureTestTablesExist();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view sales', 'create sales', 'edit sales', 'delete sales'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        Role::findOrCreate('Commercial', 'web');
        Role::findOrCreate('Manager', 'web');
        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::query()->get());

        $this->user = User::query()->create([
            'name' => 'Admin User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $this->user->assignRole($admin);
    }

    protected function ensureTestTablesExist()
    {
        $this->ensureUsersTableExists();
        $this->ensurePersonalAccessTokensTableExists();
        $this->ensurePermissionTablesExist();
        $this->ensureBrandsTableExists();
        $this->ensureProductsTableExists();
        $this->ensureProductSubtypeTablesExist();
        $this->ensureCarriersTableExists();
        $this->ensurePartnersTableExists();
        $this->ensureClientsTableExists();
        $this->ensureSalesTableExists();
        $this->ensureStocksTableExists();
        $this->ensureSaleItemsTableExists();
        $this->ensureStockMovementsTableExists();
        $this->ensureTransactionsTableExists();
        $this->ensurePaymentsTableExists();
    }

    protected function ensureUsersTableExists()
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

    protected function ensurePersonalAccessTokensTableExists()
    {
        if (! Schema::hasTable('personal_access_tokens')) {
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
    }

    protected function ensurePermissionTablesExist()
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

    protected function ensureBrandsTableExists()
    {
        if (! Schema::hasTable('brands')) {
            Schema::create('brands', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('logo')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
    }

    protected function ensureProductsTableExists()
    {
        if (! Schema::hasTable('products')) {
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
    }

    protected function ensureProductSubtypeTablesExist()
    {
        if (! Schema::hasTable('product_tyres')) {
            Schema::create('product_tyres', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_parts')) {
            Schema::create('product_parts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('product_services')) {
            Schema::create('product_services', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('product_id');
                $table->timestamps();
            });
        }
    }

    protected function ensureCarriersTableExists()
    {
        if (! Schema::hasTable('carriers')) {
            Schema::create('carriers', function (Blueprint $table) {
                $table->id();
                $table->string('name')->nullable();
                $table->timestamps();
            });
        }
    }

    protected function ensurePartnersTableExists()
    {
        if (! Schema::hasTable('partners')) {
            Schema::create('partners', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('city')->nullable();
                $table->string('phone')->nullable();
                $table->string('mobile')->nullable();
                $table->string('address')->nullable();
                $table->decimal('montage_price', 10, 2)->nullable();
                $table->decimal('alignment_price', 10, 2)->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->timestamps();
            });
        }
    }

    protected function ensureClientsTableExists()
    {
        if (! Schema::hasTable('clients')) {
            Schema::create('clients', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->string('city')->nullable();
                $table->text('address')->nullable();
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }
    }

    protected function ensureSalesTableExists()
    {
        if (! Schema::hasTable('sales')) {
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
    }

    protected function ensureStocksTableExists()
    {
        if (! Schema::hasTable('stocks')) {
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
    }

    protected function ensureSaleItemsTableExists()
    {
        if (! Schema::hasTable('sale_items')) {
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
    }

    protected function ensureStockMovementsTableExists()
    {
        if (! Schema::hasTable('stock_movements')) {
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
    }

    protected function ensureTransactionsTableExists()
    {
        if (! Schema::hasTable('transactions')) {
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
    }

    protected function ensurePaymentsTableExists()
    {
        if (! Schema::hasTable('payments')) {
            Schema::create('payments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sale_id');
                $table->unsignedBigInteger('transaction_id')->nullable();
                $table->decimal('amount', 12, 2)->default(0);
                $table->date('date')->nullable();
                $table->string('method')->nullable();
                $table->string('reference')->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->timestamps();
            });
        }
    }

    private function authHeaders()
    {
        PersonalAccessToken::query()->delete();

        $token = $this->user->createToken('test')->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    private function createSale($attributes = [])
    {
        $clientName = $attributes['client'] ?? 'Client Test';
        $clientPhone = $attributes['client_phone'] ?? null;

        if (! array_key_exists('client_id', $attributes)) {
            $clientData = [
                'name' => $clientName,
                'phone' => $clientPhone,
                'created_by' => $this->user->id,
                'updated_by' => $this->user->id,
                'is_active' => true,
            ];

            if (Schema::hasColumn('clients', 'category')) {
                $clientData['category'] = 'Particulier';
            }

            $client = Client::query()->create($clientData);

            $attributes['client_id'] = $client->id;
        }

        unset($attributes['client'], $attributes['client_phone']);

        $sale = Sale::query()->create(array_merge([
            'date' => '2026-03-01',
            'total_quantity' => 4,
            'total_purchase' => 400,
            'total_sale' => 600,
            'margin' => 200,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ], $attributes));

        if ($this->sharedProduct === null) {
            [$this->sharedProduct, $this->sharedStock] = $this->createProductWithStock(100);
        }

        $sale->items()->create([
            'product_id' => $this->sharedProduct->id,
            'stock_id' => $this->sharedStock->id,
            'quantity' => $attributes['total_quantity'] ?? 4,
            'purchase_price' => 100,
            'selling_price' => 150,
        ]);

        return $sale;
    }

    private function createCommercial($name = 'Ali Commercial')
    {
        return User::query()->create([
            'name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0611111111',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
    }

    private function createPartner($name = 'Partenaire Test')
    {
        return Partner::query()->create([
            'name' => $name,
            'user_id' => $this->user->id,
        ]);
    }

    /**
     * Records a payment and allocates it to $sale, mirroring what
     * SalePaymentService::createPayment() produces. Pass $linkPaymentToSale =
     * false to simulate a multi-sale client payment (the Payment's own
     * `sale_id` FK is left null, as the real multi-sale flow does) while
     * still allocating an amount to $sale — this is the shape that the
     * legacy `payments()` relation misses.
     */
    private function createPaymentForSale(Sale $sale, string $method, float $amount = 100, bool $linkPaymentToSale = true): Payment
    {
        $account = Account::query()->create([
            'name' => 'Caisse Test '.fake()->unique()->numerify('###'),
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $transaction = Transaction::query()->create([
            'date' => $sale->date ?? now()->toDateString(),
            'amount' => $amount,
            'type' => 'income',
            'category' => 'Produit',
            'method' => $method,
            'description' => 'Test payment',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $account->id,
        ]);

        $payment = Payment::query()->create([
            'sale_id' => $linkPaymentToSale ? $sale->id : null,
            'transaction_id' => $transaction->id,
            'user_id' => $this->user->id,
            'amount' => $amount,
            'date' => $sale->date ?? now()->toDateString(),
            'method' => $method,
        ]);

        SalePaymentAllocation::query()->create([
            'payment_id' => $payment->id,
            'sale_id' => $sale->id,
            'amount' => $amount,
        ]);

        return $payment;
    }

    public function test_index_requires_authentication()
    {
        $response = $this->getJson('/api/sales');

        $response->assertStatus(401);
    }

    public function test_index_returns_paginated_sales()
    {
        $this->createSale();
        $this->createSale(['client' => 'Client 2']);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_index_eager_loads_commercial_relationship()
    {
        $commercial = $this->createCommercial();
        $this->createSale(['commercial_id' => $commercial->id]);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('data.0.commercial.id', $commercial->id)
            ->assertJsonPath('data.0.commercial.name', 'Ali Commercial');
    }

    public function test_index_returns_null_commercial_when_not_set()
    {
        $this->createSale(['commercial_id' => null]);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('data.0.commercial', null);
    }

    public function test_index_orders_by_id_descending()
    {
        $sale1 = $this->createSale(['client' => 'First']);
        $sale2 = $this->createSale(['client' => 'Second']);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk();
        $data = $response->json('data');
        $this->assertEquals($sale2->id, $data[0]['id']);
        $this->assertEquals($sale1->id, $data[1]['id']);
    }

    public function test_index_filters_by_commercial_id()
    {
        $commercial = $this->createCommercial();
        $this->createSale(['commercial_id' => $commercial->id, 'client' => 'With commercial']);
        $this->createSale(['commercial_id' => null, 'client' => 'Without commercial']);

        $response = $this->getJson("/api/sales?commercial_id={$commercial->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client', 'With commercial');
    }

    public function test_index_filters_by_search()
    {
        $this->createSale(['client' => 'Alpha Corp']);
        $this->createSale(['client' => 'Beta Inc']);

        $response = $this->getJson('/api/sales?search=Alpha', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client', 'Alpha Corp');
    }

    public function test_index_filters_by_date_range()
    {
        $this->createSale(['date' => '2026-01-15']);
        $this->createSale(['date' => '2026-03-20']);

        $response = $this->getJson('/api/sales?date_from=2026-03-01&date_to=2026-03-31', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_show_returns_sale_with_commercial()
    {
        $commercial = $this->createCommercial();
        $sale = $this->createSale(['commercial_id' => $commercial->id]);

        $response = $this->getJson("/api/sales/{$sale->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('id', $sale->id)
            ->assertJsonPath('commercial.id', $commercial->id)
            ->assertJsonPath('commercial.name', 'Ali Commercial');
    }

    public function test_show_returns_null_commercial_when_not_set()
    {
        $sale = $this->createSale(['commercial_id' => null]);

        $response = $this->getJson("/api/sales/{$sale->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('commercial', null);
    }

    public function test_filters_returns_commercials_list()
    {
        $role = Role::findOrCreate('Commercial', 'web');

        $youssef = $this->createCommercial('Youssef');
        $youssef->assignRole($role);
        $ali = $this->createCommercial('Ali');
        $ali->assignRole($role);

        $response = $this->getJson('/api/sales-filters', $this->authHeaders());

        $response->assertOk();

        $names = collect($response->json('commercials'))->pluck('name')->toArray();
        $this->assertContains('Ali', $names);
        $this->assertContains('Youssef', $names);
        $sorted = $names;
        sort($sorted);
        $this->assertEquals($sorted, $names);
    }

    public function test_filters_returns_all_expected_keys()
    {
        $response = $this->getJson('/api/sales-filters', $this->authHeaders());

        $response->assertOk()
            ->assertJsonStructure([
                'brands',
                'clients',
                'cities',
                'statuses',
                'payment_statuses',
                'partners',
                'commercials',
            ]);
    }

    public function test_summary_returns_sales_page_kpis()
    {
        // A date within the current month but guaranteed ≠ today
        $otherDayThisMonth = now()->day === 1
            ? now()->addDay()->toDateString()
            : now()->startOfMonth()->toDateString();

        $this->createSale([
            'date' => now()->toDateString(),
            'total_quantity' => 4,
            'total_sale' => 600,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
        ]);

        $this->createSale([
            'date' => $otherDayThisMonth,
            'total_quantity' => 6,
            'total_sale' => 900,
            'status' => 'LIVRE',
            'payment_status' => 'PAYE',
        ]);

        $this->createSale([
            'date' => now()->subMonth()->startOfMonth()->toDateString(),
            'total_quantity' => 5,
            'total_sale' => 700,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
        ]);

        $response = $this->getJson('/api/sales-summary', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('tyres_today', 4)
            ->assertJsonPath('tyres_this_month', 10)
            ->assertJsonPath('tyres_period', null)
            ->assertJsonPath('tyres_en_cours', 9)
            ->assertJsonPath('sales_en_cours', 2)
            ->assertJsonPath('unpaid_en_cours', 1300);
    }

    public function test_summary_excludes_cancelled_sales_by_default()
    {
        $this->createSale([
            'date' => now()->toDateString(),
            'total_quantity' => 4,
            'total_sale' => 600,
            'with_invoice' => true,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
        ]);

        $this->createSale([
            'date' => now()->toDateString(),
            'total_quantity' => 3,
            'total_sale' => 450,
            'with_invoice' => true,
            'status' => 'ANNULE',
            'payment_status' => 'NON PAYE',
        ]);

        // No status filter: the cancelled sale must not inflate the totals.
        $response = $this->getJson('/api/sales-summary', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('ca_avec_facture', 600);

        // Explicit status=ANNULE filter: the user asked to see it, so it must show up.
        $filtered = $this->getJson('/api/sales-summary?status=ANNULE', $this->authHeaders());

        $filtered->assertOk()
            ->assertJsonPath('ca_avec_facture', 450);
    }

    public function test_summary_returns_tyres_period_when_date_filter_active()
    {
        // Inside the filtered range
        $this->createSale([
            'date' => '2026-01-10',
            'total_quantity' => 3,
            'total_sale' => 450,
        ]);
        $this->createSale([
            'date' => '2026-01-20',
            'total_quantity' => 5,
            'total_sale' => 750,
        ]);

        // Outside the filtered range — must not count towards tyres_period
        $this->createSale([
            'date' => '2026-02-01',
            'total_quantity' => 9,
            'total_sale' => 1350,
        ]);

        $response = $this->getJson(
            '/api/sales-summary?date_from=2026-01-01&date_to=2026-01-31',
            $this->authHeaders()
        );

        $response->assertOk()
            ->assertJsonPath('tyres_today', null)
            ->assertJsonPath('tyres_this_month', null)
            ->assertJsonPath('tyres_period', 8);
    }

    public function test_store_creates_sale()
    {
        $brand = Brand::query()->create(['name' => 'TestBrand', 'is_active' => true]);
        $product = Product::query()->create([
            'reference' => 'REF-1',
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);

        Schema::table('product_tyres', function (Blueprint $table) {});

        DB::table('product_tyres')->insert([
            'product_id' => $product->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $stock = Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => 10,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);

        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'client' => 'New Client',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 2,
                'purchase_price' => 100,
                'selling_price' => 200,
            ]],
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('client', 'New Client')
            ->assertJsonPath('linked_client.name', 'New Client')
            ->assertJsonPath('total_quantity', 2)
            ->assertJsonPath('total_sale', '400.00');

        $saleId = $response->json('id');
        $this->assertNotNull($saleId);

        $sale = Sale::query()->find($saleId);
        $this->assertNotNull($sale);
        $this->assertNotNull($sale->client_id);

        $this->assertDatabaseHas('clients', ['id' => $sale->client_id, 'name' => 'New Client']);
        $this->assertDatabaseHas('sale_items', ['product_id' => $product->id, 'quantity' => 2]);
    }

    public function test_destroy_deletes_sale()
    {
        $sale = $this->createSale();

        $response = $this->deleteJson("/api/sales/{$sale->id}", [], $this->authHeaders());

        $response->assertStatus(204);
        $this->assertDatabaseMissing('sales', ['id' => $sale->id]);
    }

    public function test_destroy_also_deletes_linked_payments_and_transactions(): void
    {
        $sale = $this->createSale();

        $account = DB::table('accounts')->insertGetId([
            'name' => 'Caisse test',
            'type' => 'cash',
            'initial_balance' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $transaction = Transaction::query()->create([
            'date' => now()->toDateString(),
            'amount' => 500.00,
            'type' => 'income',
            'category' => 'Produit',
            'method' => 'Espèces',
            'description' => 'Test',
            'person' => '',
            'user_id' => $this->user->id,
            'account_id' => $account,
        ]);

        $payment = Payment::query()->create([
            'sale_id' => $sale->id,
            'transaction_id' => $transaction->id,
            'amount' => 500.00,
            'date' => now()->toDateString(),
            'method' => 'Espèces',
            'user_id' => $this->user->id,
        ]);

        $this->deleteJson("/api/sales/{$sale->id}", [], $this->authHeaders())->assertStatus(204);

        $this->assertDatabaseMissing('sales', ['id' => $sale->id]);
        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
        $this->assertDatabaseMissing('transactions', ['id' => $transaction->id]);
    }

    // ── Logistics field tests ────────────────────────────────────────────────

    public function test_store_persists_logistics_fields(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);

        $carrier = Carrier::query()->create(['name' => 'Transporteur Test', 'user_id' => $this->user->id]);
        $partner = Partner::query()->create(['name' => 'Partenaire Test', 'user_id' => $this->user->id]);

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'carrier_id' => $carrier->id,
            'tracking_number' => 'TR-20260315-001',
            'partner_id' => $partner->id,
            'service' => 'Montage inclus',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $payload = array_merge($payload, [
            'delivery_date' => '2026-04-01',
            'comments' => 'Livraison express',
        ]);

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());

        $response->assertStatus(201);

        $saleId = $response->json('id');

        $this->assertDatabaseHas('sales', [
            'id' => $saleId,
            'carrier_id' => $carrier->id,
            'tracking_number' => 'TR-20260315-001',
            'partner_id' => $partner->id,
            'service' => 'Montage inclus',
            'comments' => 'Livraison express',
        ]);

        $response->assertJsonPath('carrier_id', $carrier->id)
            ->assertJsonPath('tracking_number', 'TR-20260315-001')
            ->assertJsonPath('partner_id', $partner->id)
            ->assertJsonPath('service', 'Montage inclus')
            ->assertJsonPath('delivery_date', '2026-04-01')
            ->assertJsonPath('comments', 'Livraison express');
    }

    public function test_update_persists_logistics_fields(): void
    {
        $sale = $this->createSale();
        $carrier = Carrier::query()->create(['name' => 'Transporteur MAJ', 'user_id' => $this->user->id]);
        $partner = Partner::query()->create(['name' => 'Partenaire MAJ', 'user_id' => $this->user->id]);

        $payload = [
            'carrier_id' => $carrier->id,
            'tracking_number' => 'TR-UPDATE-001',
            'partner_id' => $partner->id,
            'service' => 'Alignement',
            'delivery_date' => '2026-05-15',
            'comments' => 'Commentaire MAJ',
        ];

        $response = $this->putJson("/api/sales/{$sale->id}", $payload, $this->authHeaders());

        $response->assertOk();

        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'carrier_id' => $carrier->id,
            'tracking_number' => 'TR-UPDATE-001',
            'partner_id' => $partner->id,
            'service' => 'Alignement',
            'comments' => 'Commentaire MAJ',
        ]);

        $response->assertJsonPath('carrier_id', $carrier->id)
            ->assertJsonPath('tracking_number', 'TR-UPDATE-001')
            ->assertJsonPath('partner_id', $partner->id)
            ->assertJsonPath('service', 'Alignement')
            ->assertJsonPath('delivery_date', '2026-05-15')
            ->assertJsonPath('comments', 'Commentaire MAJ');
    }

    // ── Stock movement tests ─────────────────────────────────────────────────

    private function createProductWithStock(int $quantity = 10): array
    {
        $brand = Brand::query()->create(['name' => 'BrandStock-'.fake()->unique()->word(), 'is_active' => true]);
        $product = Product::query()->create([
            'reference' => 'REF-STK-'.fake()->unique()->numerify('####'),
            'type' => 'tyre',
            'brand_id' => $brand->id,
            'is_active' => true,
        ]);
        DB::table('product_tyres')->insert([
            'product_id' => $product->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $stock = Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);

        return [$product, $stock];
    }

    public function test_store_decrements_stock_and_records_sale_out_movement()
    {
        [$product, $stock] = $this->createProductWithStock(10);
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'client' => 'Client Stock Test',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 3,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());
        $response->assertStatus(201);

        $saleId = $response->json('id');

        $stock->refresh();
        $this->assertEquals(7, $stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'product_id' => $product->id,
            'type' => 'SALE_OUT',
            'quantity_before' => 10,
            'quantity_after' => 7,
            'delta' => -3,
            'reference_id' => $saleId,
        ]);
    }

    public function test_store_with_multiple_items_decrements_each_stock()
    {
        [$product1, $stock1] = $this->createProductWithStock(10);
        [$product2, $stock2] = $this->createProductWithStock(20);
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'client' => 'Multi Item Client',
            'items' => [
                [
                    'product_id' => $product1->id,
                    'stock_id' => $stock1->id,
                    'quantity' => 2,
                    'purchase_price' => 100,
                    'selling_price' => 150,
                ],
                [
                    'product_id' => $product2->id,
                    'stock_id' => $stock2->id,
                    'quantity' => 5,
                    'purchase_price' => 80,
                    'selling_price' => 120,
                ],
            ],
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());
        $response->assertStatus(201);

        $stock1->refresh();
        $stock2->refresh();
        $this->assertEquals(8, $stock1->quantity);
        $this->assertEquals(15, $stock2->quantity);
    }

    public function test_store_item_without_stock_id_skips_stock_movement()
    {
        [$product] = $this->createProductWithStock(10);
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'client' => 'No Stock Client',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => null,
                'quantity' => 2,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());
        $response->assertStatus(201);

        $this->assertDatabaseMissing('stock_movements', ['type' => 'SALE_OUT']);
    }

    public function test_update_restores_old_stock_and_applies_new_stock()
    {
        [$product, $stock] = $this->createProductWithStock(10);

        $sale = $this->createSale();
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);
        $stock->update(['quantity' => 7]); // simulate stock already decremented

        $payload = [
            'date' => '2026-03-15',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $response = $this->putJson("/api/sales/{$sale->id}", $payload, $this->authHeaders());
        $response->assertOk();

        // Old qty (3) restored → 7 + 3 = 10, then new qty (1) deducted → 9
        $stock->refresh();
        $this->assertEquals(9, $stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'type' => 'SALE_IN',
            'delta' => 3,
            'reference_id' => $sale->id,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'type' => 'SALE_OUT',
            'delta' => -1,
            'reference_id' => $sale->id,
        ]);
    }

    public function test_destroy_restores_stock_and_records_sale_in_movement()
    {
        [$product, $stock] = $this->createProductWithStock(7);

        $sale = $this->createSale();
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        $response = $this->deleteJson("/api/sales/{$sale->id}", [], $this->authHeaders());
        $response->assertStatus(204);

        $stock->refresh();
        $this->assertEquals(10, $stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'product_id' => $product->id,
            'type' => 'SALE_IN',
            'quantity_before' => 7,
            'quantity_after' => 10,
            'delta' => 3,
            'reference_id' => $sale->id,
        ]);

        $this->assertDatabaseMissing('sales', ['id' => $sale->id]);
    }

    // ── Cancel/reactivate stock behaviour ────────────────────────────────────

    public function test_update_status_to_annule_restores_stock(): void
    {
        [$product, $stock] = $this->createProductWithStock(7);

        $sale = $this->createSale();
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        // Only a status change — no `items` key, matching what the inline
        // status dropdown on the sales list sends.
        $response = $this->putJson("/api/sales/{$sale->id}", ['status' => 'ANNULE'], $this->authHeaders());
        $response->assertOk();

        $stock->refresh();
        $this->assertEquals(10, $stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'type' => 'SALE_IN',
            'delta' => 3,
            'reference_id' => $sale->id,
        ]);
    }

    public function test_update_status_from_annule_reapplies_stock(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);

        $sale = $this->createSale(['status' => 'ANNULE']);
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        $response = $this->putJson("/api/sales/{$sale->id}", ['status' => 'EN COURS'], $this->authHeaders());
        $response->assertOk();

        $stock->refresh();
        $this->assertEquals(7, $stock->quantity);

        $this->assertDatabaseHas('stock_movements', [
            'stock_id' => $stock->id,
            'type' => 'SALE_OUT',
            'delta' => -3,
            'reference_id' => $sale->id,
        ]);
    }

    public function test_update_status_between_active_statuses_does_not_change_stock(): void
    {
        [$product, $stock] = $this->createProductWithStock(7);

        $sale = $this->createSale();
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        $response = $this->putJson("/api/sales/{$sale->id}", ['status' => 'LIVRE'], $this->authHeaders());
        $response->assertOk();

        $stock->refresh();
        $this->assertEquals(7, $stock->quantity);
    }

    /**
     * Regression: once cancelling a sale restores its stock, deleting an
     * already-cancelled sale must NOT restore it a second time.
     */
    public function test_destroy_does_not_restore_stock_for_annule_sale(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);

        $sale = $this->createSale(['status' => 'ANNULE']);
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        $response = $this->deleteJson("/api/sales/{$sale->id}", [], $this->authHeaders());
        $response->assertStatus(204);

        $stock->refresh();
        $this->assertEquals(10, $stock->quantity);
    }

    public function test_store_does_not_decrement_stock_for_annule_status(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'client' => 'Client Annule Test',
            'status' => 'ANNULE',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 3,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());
        $response->assertStatus(201);

        $stock->refresh();
        $this->assertEquals(10, $stock->quantity);
    }

    /**
     * Combined case: items are re-submitted at the same time the sale is
     * cancelled. The old lines' stock must still be restored, but the new
     * lines must NOT be re-deducted since the sale ends up ANNULE.
     */
    public function test_update_items_while_cancelling_does_not_redecrement_stock(): void
    {
        [$product, $stock] = $this->createProductWithStock(7);

        $sale = $this->createSale();
        $sale->items()->create([
            'product_id' => $product->id,
            'stock_id' => $stock->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'selling_price' => 150,
            'total_purchase' => 300,
            'total_sale' => 450,
            'margin' => 150,
        ]);

        $payload = [
            'status' => 'ANNULE',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 2,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $response = $this->putJson("/api/sales/{$sale->id}", $payload, $this->authHeaders());
        $response->assertOk();

        // Old qty (3) restored -> 7 + 3 = 10; new qty (2) NOT deducted because
        // the sale ends up ANNULE -> stays 10.
        $stock->refresh();
        $this->assertEquals(10, $stock->quantity);
    }

    // ── Accès par rôle : Manager & Commercial ────────────────────────────────

    private function makeManager(): User
    {
        Permission::findOrCreate('view users', 'web');

        $managerRole = Role::findOrCreate('Manager', 'web');
        $managerRole->syncPermissions(['view sales', 'create sales', 'edit sales']); // pas view users

        $user = User::query()->create([
            'name' => 'Test Manager',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000010',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $user->assignRole($managerRole);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $user;
    }

    private function makeCommercial(): User
    {
        Permission::findOrCreate('view users', 'web');

        $commercialRole = Role::findOrCreate('Commercial', 'web');
        $commercialRole->syncPermissions(['view sales', 'create sales', 'edit sales', 'view users']);

        $user = User::query()->create([
            'name' => 'Test Commercial',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000011',
            'commission_rate' => 5,
            'must_change_password' => false,
        ]);
        $user->assignRole($commercialRole);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $user;
    }

    private function tokenFor(User $user): array
    {
        $token = $user->createToken('test-role')->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_manager_is_forbidden_from_users_list(): void
    {
        $manager = $this->makeManager();

        $this->getJson('/api/users', $this->tokenFor($manager))
            ->assertForbidden();
    }

    public function test_manager_can_access_sales_filters_with_commercials(): void
    {
        $commercialRole = Role::findOrCreate('Commercial', 'web');
        $youssef = $this->createCommercial('Youssef Filtre');
        $youssef->assignRole($commercialRole);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $manager = $this->makeManager();

        $response = $this->getJson('/api/sales-filters', $this->tokenFor($manager));

        $response->assertOk();
        $names = collect($response->json('commercials'))->pluck('name')->toArray();
        $this->assertContains('Youssef Filtre', $names);
    }

    public function test_commercial_can_access_sales_filters_with_commercials(): void
    {
        $commercialRole = Role::findOrCreate('Commercial', 'web');
        $ali = $this->createCommercial('Ali Filtre');
        $ali->assignRole($commercialRole);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $commercial = $this->makeCommercial();

        $response = $this->getJson('/api/sales-filters', $this->tokenFor($commercial));

        $response->assertOk();
        $names = collect($response->json('commercials'))->pluck('name')->toArray();
        $this->assertContains('Ali Filtre', $names);
    }

    public function test_store_requires_partner_id(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $this->user->id,
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $this->postJson('/api/sales', $payload, $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['partner_id']);
    }

    public function test_manager_can_create_a_sale(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);
        $manager = $this->makeManager();
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $manager->id,
            'partner_id' => $partner->id,
            'client' => 'Client Manager Test',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 100,
                'selling_price' => 150,
            ]],
        ];

        $this->postJson('/api/sales', $payload, $this->tokenFor($manager))
            ->assertStatus(201)
            ->assertJsonPath('client', 'Client Manager Test');
    }

    // ── Export Excel ─────────────────────────────────────────────────────────

    public function test_export_streams_xlsx(): void
    {
        $this->createSale(['date' => '2026-04-10']);
        $this->createSale(['date' => '2026-04-15']);

        $response = $this->get('/api/sales/export', $this->authHeaders());

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    public function test_export_requires_authentication(): void
    {
        $this->getJson('/api/sales/export')->assertUnauthorized();
    }

    public function test_export_applies_date_filter(): void
    {
        $this->createSale(['date' => '2026-01-15']);
        $this->createSale(['date' => '2026-04-15']);

        $response = $this->get('/api/sales/export?date_from=2026-04-01&date_to=2026-04-30', $this->authHeaders());

        $response->assertOk();
        $this->assertStringContainsString(
            'spreadsheetml',
            $response->headers->get('Content-Type')
        );
    }

    public function test_commercial_can_create_a_sale(): void
    {
        [$product, $stock] = $this->createProductWithStock(10);
        $commercial = $this->makeCommercial();
        $partner = $this->createPartner();

        $payload = [
            'date' => '2026-03-15',
            'commercial_id' => $commercial->id,
            'partner_id' => $partner->id,
            'client' => 'Client Commercial Test',
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 80,
                'selling_price' => 120,
            ]],
        ];

        $this->postJson('/api/sales', $payload, $this->tokenFor($commercial))
            ->assertStatus(201)
            ->assertJsonPath('client', 'Client Commercial Test');
    }

    // -------------------------------------------------------------------------
    // Enum validation — non-regression
    // -------------------------------------------------------------------------

    private function validSaleApiPayload(array $overrides = []): array
    {
        [$product, $stock] = $this->createProductWithStock(10);
        $partner = $this->createPartner();

        return array_merge([
            'date' => '2026-06-01',
            'client' => 'Validation Client',
            'commercial_id' => $this->user->id,
            'partner_id' => $partner->id,
            'status' => SaleStatus::EN_COURS->value,
            'payment_status' => SalePaymentStatus::NON_PAYE->value,
            'items' => [[
                'product_id' => $product->id,
                'stock_id' => $stock->id,
                'quantity' => 1,
                'purchase_price' => 80,
                'selling_price' => 120,
            ]],
        ], $overrides);
    }

    public function test_store_rejects_invalid_status(): void
    {
        $this->postJson('/api/sales', $this->validSaleApiPayload(['status' => 'INVALID']), $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_store_rejects_accented_payment_status(): void
    {
        $this->postJson('/api/sales', $this->validSaleApiPayload(['payment_status' => 'NON PAYÉ']), $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment_status']);
    }

    public function test_store_rejects_accented_paye(): void
    {
        $this->postJson('/api/sales', $this->validSaleApiPayload(['payment_status' => 'PAYÉ']), $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment_status']);
    }

    public function test_store_accepts_all_valid_statuses(): void
    {
        foreach (SaleStatus::values() as $status) {
            $this->postJson('/api/sales', $this->validSaleApiPayload(['status' => $status]), $this->authHeaders())
                ->assertCreated();
        }
    }

    public function test_store_accepts_all_valid_payment_statuses(): void
    {
        foreach (SalePaymentStatus::values() as $ps) {
            $this->postJson('/api/sales', $this->validSaleApiPayload(['payment_status' => $ps]), $this->authHeaders())
                ->assertCreated();
        }
    }

    // ── Dynamic payment_methods (derived from allocations) ──────────────────

    public function test_index_exposes_distinct_payment_methods_in_canonical_order(): void
    {
        $sale = $this->createSale();
        $this->createPaymentForSale($sale, 'Virement');
        $this->createPaymentForSale($sale, 'Espèces');

        $response = $this->getJson('/api/sales?per_page=100', $this->authHeaders());

        $response->assertOk();
        $index = collect($response->json('data'))->search(fn ($row) => $row['id'] === $sale->id);
        $this->assertNotFalse($index);
        // Canonical vocabulary order (Espèces, Chèque, Virement, ...), not insertion order.
        $this->assertSame(['Espèces', 'Virement'], $response->json("data.{$index}.payment_methods"));
    }

    public function test_index_dedupes_repeated_payment_methods(): void
    {
        $sale = $this->createSale();
        $this->createPaymentForSale($sale, 'Chèque');
        $this->createPaymentForSale($sale, 'Chèque');

        $response = $this->getJson('/api/sales?per_page=100', $this->authHeaders());
        $index = collect($response->json('data'))->search(fn ($row) => $row['id'] === $sale->id);

        $this->assertSame(['Chèque'], $response->json("data.{$index}.payment_methods"));
    }

    public function test_index_returns_empty_payment_methods_when_no_payments(): void
    {
        $sale = $this->createSale();

        $response = $this->getJson('/api/sales?per_page=100', $this->authHeaders());
        $index = collect($response->json('data'))->search(fn ($row) => $row['id'] === $sale->id);

        $this->assertSame([], $response->json("data.{$index}.payment_methods"));
    }

    public function test_index_filters_by_recorded_payment_method(): void
    {
        $saleA = $this->createSale(['client' => 'Client Chèque']);
        $this->createPaymentForSale($saleA, 'Chèque');

        $saleB = $this->createSale(['client' => 'Client Espèces']);
        $this->createPaymentForSale($saleB, 'Espèces');

        $saleC = $this->createSale(['client' => 'Client Impayé']);

        $response = $this->getJson('/api/sales?per_page=100&payment_method=Chèque', $this->authHeaders());
        $ids = collect($response->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($saleA->id));
        $this->assertFalse($ids->contains($saleB->id));
        $this->assertFalse($ids->contains($saleC->id));
    }

    public function test_index_filter_matches_sale_with_several_payment_methods(): void
    {
        $sale = $this->createSale();
        $this->createPaymentForSale($sale, 'Chèque');
        $this->createPaymentForSale($sale, 'Espèces');

        foreach (['Chèque', 'Espèces'] as $method) {
            $response = $this->getJson('/api/sales?per_page=100&payment_method='.urlencode($method), $this->authHeaders());
            $ids = collect($response->json('data'))->pluck('id');
            $this->assertTrue($ids->contains($sale->id), "Expected sale to match filter '{$method}'");
        }
    }

    public function test_export_applies_payment_method_filter(): void
    {
        $sale = $this->createSale();
        $this->createPaymentForSale($sale, 'Chèque');

        $this->get('/api/sales/export?payment_method=Chèque', $this->authHeaders())
            ->assertOk();
    }

    /**
     * Regression: payment_methods (and the payment_method filter) must be
     * derived from allocations(), never from the legacy payments() relation.
     * A client payment covering several sales leaves `sale_id` null on the
     * Payment row and is only reachable through its allocations — using
     * whereHas('payments', ...) or $sale->payments here would silently miss it.
     */
    public function test_multi_sale_payment_is_reflected_on_every_allocated_sale(): void
    {
        $saleA = $this->createSale(['client' => 'Client Multi A']);
        $saleB = $this->createSale(['client' => 'Client Multi B']);

        // Single Payment (sale_id left null, as a real multi-sale client
        // payment would), allocated across both sales.
        $payment = $this->createPaymentForSale($saleA, 'Virement', 100, linkPaymentToSale: false);
        SalePaymentAllocation::query()->create([
            'payment_id' => $payment->id,
            'sale_id' => $saleB->id,
            'amount' => 100,
        ]);

        $response = $this->getJson('/api/sales?per_page=100', $this->authHeaders());
        $rowsById = collect($response->json('data'))->keyBy('id');

        $this->assertSame(['Virement'], $rowsById[$saleA->id]['payment_methods']);
        $this->assertSame(['Virement'], $rowsById[$saleB->id]['payment_methods']);

        $filtered = $this->getJson('/api/sales?per_page=100&payment_method=Virement', $this->authHeaders());
        $ids = collect($filtered->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($saleA->id));
        $this->assertTrue($ids->contains($saleB->id));
    }
}
