<?php

namespace Tests\Feature;

use App\Http\Requests\StoreClientRequest;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateClientRequest;
use App\Models\Client;
use App\Models\Partner;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ClientManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_profile_endpoint_returns_summary_metrics_and_sales_history(): void
    {
        $user = $this->authenticateWithPermissions(['view clients']);

        $client = Client::create([
            'name' => 'Acme Stores',
            'category' => 'Entreprise',
            'phone' => '0600000000',
            'city' => 'Casablanca',
            'opening_balance' => 50,
            'credit_limit' => 500,
            'is_active' => true,
        ]);

        $firstSale = Sale::create([
            'client_id' => $client->id,
            'city' => 'Casablanca',
            'date' => now()->subDays(2)->toDateString(),
            'total_sale' => 100,
            'payment_method' => 'cash',
            'status' => 'partial',
        ]);

        $secondSale = Sale::create([
            'client_id' => $client->id,
            'city' => 'Casablanca',
            'date' => now()->subDay()->toDateString(),
            'total_sale' => 80,
            'payment_method' => 'cash',
            'status' => 'paid',
        ]);

        Payment::create([
            'sale_id' => $firstSale->id,
            'amount' => 40,
            'date' => now()->subDays(2)->toDateString(),
            'method' => 'cash',
            'notes' => 'Partial payment',
            'user_id' => $user->id,
        ]);

        Payment::create([
            'sale_id' => $secondSale->id,
            'amount' => 80,
            'date' => now()->subDay()->toDateString(),
            'method' => 'cash',
            'notes' => 'Full payment',
            'user_id' => $user->id,
        ]);

        $response = $this->getJson('/api/clients/' . $client->id . '/profile');

        $response
            ->assertOk()
            ->assertJsonPath('data.client.id', $client->id)
            ->assertJsonPath('data.client.category', 'Entreprise')
            ->assertJsonPath('data.sales_count', 2)
            ->assertJsonPath('data.total_purchased', 180)
            ->assertJsonPath('data.outstanding_balance', 110)
            ->assertJsonCount(2, 'data.sales_history');
    }

    public function test_client_statement_endpoint_returns_summary_sales_payments_and_entries(): void
    {
        $user = $this->authenticateWithPermissions(['view clients']);

        $client = Client::create([
            'name' => 'Beta Client',
            'category' => 'Particulier',
            'phone' => '0700000000',
            'city' => 'Rabat',
            'opening_balance' => 25,
            'is_active' => true,
        ]);

        $sale = Sale::create([
            'client_id' => $client->id,
            'city' => 'Rabat',
            'date' => now()->subDay()->toDateString(),
            'total_sale' => 120,
            'payment_method' => 'cash',
            'status' => 'partial',
        ]);

        Payment::create([
            'sale_id' => $sale->id,
            'amount' => 20,
            'date' => now()->toDateString(),
            'method' => 'cash',
            'notes' => 'Initial payment',
            'user_id' => $user->id,
        ]);

        $response = $this->getJson('/api/clients/' . $client->id . '/statement');

        $response
            ->assertOk()
            ->assertJsonPath('data.client.id', $client->id)
            ->assertJsonPath('data.client.category', 'Particulier')
            ->assertJsonPath('data.summary.sales_count', 1)
            ->assertJsonPath('data.summary.opening_balance', 25)
            ->assertJsonPath('data.summary.total_sales', 120)
            ->assertJsonPath('data.summary.total_paid', 20)
            ->assertJsonPath('data.summary.outstanding_balance', 125)
            ->assertJsonCount(1, 'data.sales')
            ->assertJsonCount(1, 'data.payments');

        $this->assertGreaterThanOrEqual(2, count($response->json('data.entries')));
    }

    public function test_store_client_request_requires_allowed_category_values(): void
    {
        $missingCategoryValidator = Validator::make([
            'name' => 'Validator Client',
        ], (new StoreClientRequest())->rules());

        $this->assertTrue($missingCategoryValidator->passes());

        $invalidCategoryValidator = Validator::make([
            'name' => 'Validator Client',
            'category' => 'Invalid',
        ], (new StoreClientRequest())->rules());

        $this->assertFalse($invalidCategoryValidator->passes());
        $this->assertArrayHasKey('category', $invalidCategoryValidator->errors()->toArray());

        $validCategoryValidator = Validator::make([
            'name' => 'Validator Client',
            'category' => 'Particulier',
        ], (new StoreClientRequest())->rules());

        $this->assertTrue($validCategoryValidator->passes(), json_encode($validCategoryValidator->errors()->toArray()));

        $enterpriseCategoryValidator = Validator::make([
            'name' => 'Validator Client',
            'category' => 'Entreprise',
        ], (new StoreClientRequest())->rules());

        $this->assertTrue($enterpriseCategoryValidator->passes(), json_encode($enterpriseCategoryValidator->errors()->toArray()));
    }

    public function test_update_client_request_rejects_invalid_category_values(): void
    {
        $client = Client::create([
            'name' => 'Update Validator Client',
            'category' => 'Particulier',
            'phone' => '0811111111',
            'is_active' => true,
        ]);

        $request = UpdateClientRequest::create('/api/clients/' . $client->id, 'PATCH', [
            'category' => 'Invalid',
        ]);

        $request->setRouteResolver(function () use ($client) {
            return new class($client)
            {
                public function __construct(private Client $client)
                {
                }

                public function parameter(string $key): mixed
                {
                    return $key === 'client' ? $this->client : null;
                }
            };
        });

        $validator = Validator::make($request->all(), $request->rules());

        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('category', $validator->errors()->toArray());
    }

    public function test_store_sale_request_accepts_existing_client_id(): void
    {
        $client = Client::create([
            'name' => 'Validator Client',
            'category' => 'Particulier',
            'phone' => '0800000000',
            'is_active' => true,
        ]);

        $product = Product::create([
            'reference' => 'VALIDATOR-PRODUCT',
            'type' => 'tyre',
            'is_active' => true,
        ]);

        $commercial = User::factory()->create();

        $partner = Partner::create([
            'name' => 'Validator Partner',
            'is_active' => true,
            'user_id' => $commercial->id,
        ]);

        $validator = Validator::make([
            'date' => now()->toDateString(),
            'client_id' => $client->id,
            'commercial_id' => $commercial->id,
            'partner_id' => $partner->id,
            'payment_method' => 'Espèces',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'selling_price' => 99.99,
            ]],
        ], (new StoreSaleRequest())->rules());

        $this->assertTrue($validator->passes(), json_encode($validator->errors()->toArray()));
    }

    protected function authenticateWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $permissionName) {
            Permission::findOrCreate($permissionName);
            $user->givePermissionTo($permissionName);
        }

        Sanctum::actingAs($user);

        return $user;
    }
}
