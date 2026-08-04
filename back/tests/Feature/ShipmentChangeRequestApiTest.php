<?php

namespace Tests\Feature;

use App\Models\Carrier;
use App\Models\Sale;
use App\Models\ShipmentChangeRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ShipmentChangeRequestApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Sale $sale;

    private Carrier $carrier;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view shipment-changes', 'create shipment-changes',
            'edit shipment-changes', 'delete shipment-changes',
        ] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }

        $admin = Role::findOrCreate('Administrator', 'web');
        $admin->syncPermissions(Permission::all());

        $this->user = User::query()->create([
            'name' => 'Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->assignRole($admin);

        $this->carrier = Carrier::query()->create([
            'name' => 'MTR',
            'phone' => '0522000000',
            'email' => 'contact@mtr.example.com',
            'user_id' => $this->user->id,
        ]);

        $this->sale = $this->createSale();
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'Guest User',
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

    private function createSale(array $overrides = []): Sale
    {
        return Sale::query()->create(array_merge([
            'date' => '2026-08-01',
            'client' => 'Client Test',
            'total_quantity' => 4,
            'total_purchase' => 400,
            'total_sale' => 600,
            'margin' => 200,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'carrier_id' => $this->carrier->id,
            'tracking_number' => 'TRK-0001',
            'created_by' => $this->user->id,
        ], $overrides));
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-08-04',
            'reason' => 'Erreur de saisie côté client',
            'items' => [
                [
                    'field' => 'payment_method',
                    'old_value' => 'Contre-remboursement',
                    'new_value' => 'Virement',
                ],
                [
                    'field' => 'amount',
                    'old_value' => '600.00',
                    'new_value' => '550.00',
                ],
            ],
        ], $overrides);
    }

    private function createRequestForSale(array $overrides = []): ShipmentChangeRequest
    {
        return ShipmentChangeRequest::query()->create(array_merge([
            'sale_id' => $this->sale->id,
            'carrier_id' => $this->carrier->id,
            'shipment_number' => 'TRK-0001',
            'date' => '2026-08-04',
            'status' => 'BROUILLON',
            'created_by' => $this->user->id,
        ], $overrides));
    }

    // -------------------------------------------------------------------------
    // Authentication / permissions
    // -------------------------------------------------------------------------

    public function test_endpoints_require_authentication(): void
    {
        $requestModel = $this->createRequestForSale();

        $this->getJson('/api/shipment-change-requests')->assertUnauthorized();
        $this->getJson("/api/sales/{$this->sale->id}/shipment-change-requests")->assertUnauthorized();
        $this->postJson("/api/sales/{$this->sale->id}/shipment-change-requests", $this->validPayload())->assertUnauthorized();
        $this->putJson("/api/shipment-change-requests/{$requestModel->id}", $this->validPayload())->assertUnauthorized();
        $this->patchJson("/api/shipment-change-requests/{$requestModel->id}/status", ['status' => 'ENVOYEE'])->assertUnauthorized();
        $this->deleteJson("/api/shipment-change-requests/{$requestModel->id}")->assertUnauthorized();
    }

    public function test_index_requires_view_permission(): void
    {
        $guest = $this->createUserWithPermissions([]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/shipment-change-requests')->assertForbidden();
    }

    public function test_store_requires_create_permission(): void
    {
        $guest = $this->createUserWithPermissions(['view shipment-changes']);
        Sanctum::actingAs($guest, [], 'web');

        $this->postJson("/api/sales/{$this->sale->id}/shipment-change-requests", $this->validPayload())
            ->assertForbidden();
    }

    public function test_update_requires_edit_permission(): void
    {
        $requestModel = $this->createRequestForSale();
        $guest = $this->createUserWithPermissions(['view shipment-changes']);
        Sanctum::actingAs($guest, [], 'web');

        $this->putJson("/api/shipment-change-requests/{$requestModel->id}", $this->validPayload())
            ->assertForbidden();
    }

    public function test_delete_requires_delete_permission(): void
    {
        $requestModel = $this->createRequestForSale();
        $guest = $this->createUserWithPermissions(['view shipment-changes']);
        Sanctum::actingAs($guest, [], 'web');

        $this->deleteJson("/api/shipment-change-requests/{$requestModel->id}")
            ->assertForbidden();
    }

    // -------------------------------------------------------------------------
    // Create
    // -------------------------------------------------------------------------

    public function test_store_creates_request_with_multiple_items(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson("/api/sales/{$this->sale->id}/shipment-change-requests", $this->validPayload());

        $response->assertCreated()
            ->assertJsonPath('sale_id', $this->sale->id)
            ->assertJsonPath('status', 'BROUILLON')
            ->assertJsonCount(2, 'items');

        $this->assertDatabaseHas('shipment_change_requests', [
            'sale_id' => $this->sale->id,
            'status' => 'BROUILLON',
        ]);
        $this->assertDatabaseCount('shipment_change_request_items', 2);
    }

    public function test_store_prefills_carrier_and_shipment_number_from_sale_when_omitted(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->postJson(
            "/api/sales/{$this->sale->id}/shipment-change-requests",
            $this->validPayload()
        );

        $response->assertCreated()
            ->assertJsonPath('carrier_id', $this->carrier->id)
            ->assertJsonPath('shipment_number', 'TRK-0001');
    }

    public function test_store_validates_items_required(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->postJson(
            "/api/sales/{$this->sale->id}/shipment-change-requests",
            $this->validPayload(['items' => []])
        )->assertJsonValidationErrors('items');
    }

    // -------------------------------------------------------------------------
    // Status transitions
    // -------------------------------------------------------------------------

    public function test_status_update_to_envoyee_sets_sent_at(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $requestModel = $this->createRequestForSale();

        $response = $this->patchJson("/api/shipment-change-requests/{$requestModel->id}/status", [
            'status' => 'ENVOYEE',
        ]);

        $response->assertOk()->assertJsonPath('status', 'ENVOYEE');
        $this->assertNotNull($response->json('sent_at'));
    }

    public function test_editing_a_closed_request_is_blocked(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $requestModel = $this->createRequestForSale(['status' => 'ACCEPTEE']);

        $this->putJson("/api/shipment-change-requests/{$requestModel->id}", $this->validPayload())
            ->assertStatus(422);
    }

    public function test_deleting_a_closed_request_is_blocked(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $requestModel = $this->createRequestForSale(['status' => 'REFUSEE']);

        $this->deleteJson("/api/shipment-change-requests/{$requestModel->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('shipment_change_requests', ['id' => $requestModel->id]);
    }

    // -------------------------------------------------------------------------
    // Delete / cascade
    // -------------------------------------------------------------------------

    public function test_delete_removes_request_and_its_items(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $requestModel = $this->createRequestForSale();
        $requestModel->items()->create([
            'field' => 'city',
            'old_value' => 'Casablanca',
            'new_value' => 'Rabat',
        ]);

        $this->deleteJson("/api/shipment-change-requests/{$requestModel->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('shipment_change_requests', ['id' => $requestModel->id]);
        $this->assertDatabaseMissing('shipment_change_request_items', ['shipment_change_request_id' => $requestModel->id]);
    }

    public function test_deleting_sale_cascades_to_shipment_change_requests(): void
    {
        $requestModel = $this->createRequestForSale();

        $this->sale->delete();

        $this->assertDatabaseMissing('shipment_change_requests', ['id' => $requestModel->id]);
    }

    // -------------------------------------------------------------------------
    // Listing
    // -------------------------------------------------------------------------

    public function test_for_sale_returns_requests_scoped_to_the_sale(): void
    {
        Sanctum::actingAs($this->user, [], 'web');
        $this->createRequestForSale();
        $otherSale = $this->createSale(['tracking_number' => 'TRK-0002']);
        $this->createRequestForSale(['sale_id' => $otherSale->id]);

        $response = $this->getJson("/api/sales/{$this->sale->id}/shipment-change-requests");

        $response->assertOk()->assertJsonCount(1, 'data');
    }
}
