<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\ServiceOrder;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class DashboardTodoApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['view sales', 'view purchases', 'view service-orders', 'view stock', 'view cash-flow'] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        $this->user = $this->makeUser(['view sales', 'view purchases', 'view service-orders', 'view stock', 'view cash-flow']);
    }

    public function test_todo_requires_authentication(): void
    {
        $this->getJson('/api/dashboard-todo')->assertUnauthorized();
    }

    public function test_todo_returns_all_blocks_for_a_user_with_every_permission(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/dashboard-todo');

        $response->assertOk()->assertJsonStructure([
            'unpaid_sales' => ['count', 'total', 'rows'],
            'unpaid_purchases' => ['count', 'total', 'old_debt_days', 'old_debt_count', 'rows'],
            'to_invoice' => ['count', 'total', 'rows'],
            'low_stock' => ['count', 'rows'],
            'collected_today',
            'sales_last_30_days',
        ]);
        $this->assertCount(30, $response->json('sales_last_30_days'));
    }

    public function test_todo_omits_blocks_the_user_cannot_see(): void
    {
        $limited = $this->makeUser(['view sales']);
        Sanctum::actingAs($limited, [], 'web');

        $response = $this->getJson('/api/dashboard-todo');

        $response->assertOk();
        $this->assertNotNull($response->json('unpaid_sales'));
        $this->assertNull($response->json('unpaid_purchases'));
        $this->assertNull($response->json('to_invoice'));
        $this->assertNull($response->json('low_stock'));
        $this->assertNull($response->json('collected_today'));
    }

    public function test_unpaid_sale_appears_with_its_remaining_and_age(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $client = Client::query()->create([
            'name' => 'Client À Traiter Test',
            'phone' => '0600000050',
            'category' => 'Particulier',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
            'is_active' => true,
        ]);

        $sale = Sale::query()->create([
            'date' => Carbon::today()->subDays(40)->toDateString(),
            'client_id' => $client->id,
            'total_quantity' => 1,
            'total_purchase' => 500,
            'total_sale' => 3000,
            'margin' => 2500,
            'status' => 'EN COURS',
            'payment_status' => 'PARTIEL',
            'created_by' => $this->user->id,
        ]);

        $payment = Payment::query()->create([
            'sale_id' => $sale->id,
            'client_id' => $client->id,
            'amount' => 1000,
            'date' => Carbon::today()->subDays(30)->toDateString(),
            'method' => 'Espèces',
            'user_id' => $this->user->id,
        ]);
        SalePaymentAllocation::query()->create(['payment_id' => $payment->id, 'sale_id' => $sale->id, 'amount' => 1000]);

        $response = $this->getJson('/api/dashboard-todo');

        $response->assertOk();
        $row = collect($response->json('unpaid_sales.rows'))->firstWhere('id', $sale->id);
        $this->assertNotNull($row, 'La vente impayée doit figurer dans « à traiter ».');
        $this->assertEquals(2000, $row['amount']);
        $this->assertEquals(40, $row['days']);
        $this->assertSame('Client À Traiter Test', $row['client_name']);
    }

    public function test_fully_paid_sale_is_absent(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $sale = Sale::query()->create([
            'date' => Carbon::today()->subDays(10)->toDateString(),
            'total_quantity' => 1,
            'total_purchase' => 100,
            'total_sale' => 900,
            'margin' => 800,
            'status' => 'LIVRE',
            'payment_status' => 'PAYE',
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/dashboard-todo');

        $response->assertOk();
        $ids = collect($response->json('unpaid_sales.rows'))->pluck('id');
        $this->assertNotContains($sale->id, $ids);
    }

    public function test_old_supplier_debt_is_counted_separately(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $supplier = Supplier::query()->create(['name' => 'Fournisseur Ancien Test', 'user_id' => $this->user->id]);

        $before = $this->getJson('/api/dashboard-todo')->json('unpaid_purchases.old_debt_count');

        Purchase::query()->create([
            'date' => Carbon::today()->subDays(200)->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 4,
            'total_price' => 8000,
            'net_amount' => 8000,
            'discount' => 0,
            'status' => 'RECU',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $after = $this->getJson('/api/dashboard-todo')->json('unpaid_purchases.old_debt_count');

        $this->assertSame($before + 1, $after);
    }

    public function test_service_order_to_invoice_appears(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $order = ServiceOrder::query()->create([
            'date' => Carbon::today()->subDays(3)->toDateString(),
            'vehicle' => 'TODO-TEST Dacia Sandero',
            'total_amount' => 1200,
            'net_amount' => 1200,
            'discount' => 0,
            'status' => 'TERMINE',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $this->user->id,
            'created_by' => $this->user->id,
        ]);

        $response = $this->getJson('/api/dashboard-todo');

        $response->assertOk();
        $row = collect($response->json('to_invoice.rows'))->firstWhere('id', $order->id);
        $this->assertNotNull($row);
        $this->assertEquals(1200, $row['amount']);
        $this->assertSame('TODO-TEST Dacia Sandero', $row['vehicle']);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function makeUser(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Todo Test User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000051',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $user->givePermissionTo($permissions);

        return $user;
    }
}
