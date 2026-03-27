<?php

namespace Tests\Feature;

use App\Models\Personnel;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaleControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function authHeaders(): array
    {
        $token = $this->user->createToken('test')->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    private function createSale(array $attributes = []): Sale
    {
        return Sale::create(array_merge([
            'date' => '2026-03-01',
            'client' => 'Client Test',
            'brand' => 'Michelin',
            'dimension' => '205/55R16',
            'quantity' => 4,
            'purchase_price' => 100,
            'total_purchase' => 400,
            'selling_price' => 150,
            'total_sale' => 600,
            'margin' => 200,
            'city' => 'Casablanca',
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYÉ',
            'user_id' => $this->user->id,
        ], $attributes));
    }

    private function createCommercial(string $name = 'Ali Commercial'): Personnel
    {
        return Personnel::create([
            'name' => $name,
            'role' => 'Commercial',
            'user_id' => $this->user->id,
        ]);
    }

    // -------------------------------------------------------
    // index()
    // -------------------------------------------------------

    public function test_index_requires_authentication(): void
    {
        $response = $this->getJson('/api/sales');

        $response->assertStatus(401);
    }

    public function test_index_returns_paginated_sales(): void
    {
        $this->createSale();
        $this->createSale(['client' => 'Client 2']);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'data');
    }

    public function test_index_eager_loads_commercial_relationship(): void
    {
        $commercial = $this->createCommercial();
        $this->createSale(['commercial_id' => $commercial->id]);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('data.0.commercial.id', $commercial->id)
            ->assertJsonPath('data.0.commercial.name', 'Ali Commercial');
    }

    public function test_index_returns_null_commercial_when_not_set(): void
    {
        $this->createSale(['commercial_id' => null]);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('data.0.commercial', null);
    }

    public function test_index_orders_by_id_descending(): void
    {
        $sale1 = $this->createSale(['client' => 'First']);
        $sale2 = $this->createSale(['client' => 'Second']);

        $response = $this->getJson('/api/sales', $this->authHeaders());

        $response->assertOk();
        $data = $response->json('data');
        $this->assertEquals($sale2->id, $data[0]['id']);
        $this->assertEquals($sale1->id, $data[1]['id']);
    }

    public function test_index_filters_by_commercial_id(): void
    {
        $commercial = $this->createCommercial();
        $this->createSale(['commercial_id' => $commercial->id, 'client' => 'With commercial']);
        $this->createSale(['commercial_id' => null, 'client' => 'Without commercial']);

        $response = $this->getJson("/api/sales?commercial_id={$commercial->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client', 'With commercial');
    }

    public function test_index_filters_by_search(): void
    {
        $this->createSale(['client' => 'Alpha Corp']);
        $this->createSale(['client' => 'Beta Inc']);

        $response = $this->getJson('/api/sales?search=Alpha', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client', 'Alpha Corp');
    }

    public function test_index_filters_by_brand(): void
    {
        $this->createSale(['brand' => 'Michelin']);
        $this->createSale(['brand' => 'Continental']);

        $response = $this->getJson('/api/sales?brand=Continental', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.brand', 'Continental');
    }

    public function test_index_filters_by_date_range(): void
    {
        $this->createSale(['date' => '2026-01-15']);
        $this->createSale(['date' => '2026-03-20']);

        $response = $this->getJson('/api/sales?date_from=2026-03-01&date_to=2026-03-31', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(1, 'data');
    }

    // -------------------------------------------------------
    // show()
    // -------------------------------------------------------

    public function test_show_returns_sale_with_commercial(): void
    {
        $commercial = $this->createCommercial();
        $sale = $this->createSale(['commercial_id' => $commercial->id]);

        $response = $this->getJson("/api/sales/{$sale->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('id', $sale->id)
            ->assertJsonPath('commercial.id', $commercial->id)
            ->assertJsonPath('commercial.name', 'Ali Commercial');
    }

    public function test_show_returns_null_commercial_when_not_set(): void
    {
        $sale = $this->createSale(['commercial_id' => null]);

        $response = $this->getJson("/api/sales/{$sale->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('commercial', null);
    }

    // -------------------------------------------------------
    // filters()
    // -------------------------------------------------------

    public function test_filters_returns_commercials_list(): void
    {
        $this->createCommercial('Youssef');
        $this->createCommercial('Ali');
        // Non-commercial should be excluded
        Personnel::create(['name' => 'Karim', 'role' => 'Chauffeur', 'user_id' => $this->user->id]);

        $response = $this->getJson('/api/sales-filters', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(2, 'commercials');

        $names = collect($response->json('commercials'))->pluck('name')->toArray();
        // Should be ordered by name
        $this->assertEquals(['Ali', 'Youssef'], $names);
    }

    public function test_filters_returns_all_expected_keys(): void
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

    // -------------------------------------------------------
    // store() / update() / destroy()
    // -------------------------------------------------------

    public function test_store_creates_sale(): void
    {
        $payload = [
            'date' => '2026-03-15',
            'client' => 'New Client',
            'brand' => 'Goodyear',
            'quantity' => 2,
            'selling_price' => 200,
            'total_sale' => 400,
        ];

        $response = $this->postJson('/api/sales', $payload, $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('client', 'New Client');
        $this->assertDatabaseHas('sales', ['client' => 'New Client']);
    }

    public function test_destroy_deletes_sale(): void
    {
        $sale = $this->createSale();

        $response = $this->deleteJson("/api/sales/{$sale->id}", [], $this->authHeaders());

        $response->assertStatus(204);
        $this->assertDatabaseMissing('sales', ['id' => $sale->id]);
    }
}
