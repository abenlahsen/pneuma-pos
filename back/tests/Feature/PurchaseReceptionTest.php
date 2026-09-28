<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Support\BusinessDate;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Le stock n'entre qu'à la réception.
 *
 * Un achat attendu (« En cours ») garde ses quantités sur l'achat ; la
 * réception (POST /purchases/{id}/receive) les fait entrer dans les dépôts,
 * passe le statut à « Reçu » et date la réception. Un achat créé « Reçu »
 * entre en stock à l'enregistrement.
 */
class PurchaseReceptionTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    private Supplier $supplier;

    private Product $product;

    private Stock $stock;

    private Stock $otherStock;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view purchases', 'create purchases', 'edit purchases', 'delete purchases', 'cancel purchases', 'view stock'] as $perm) {
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

        $brand = Brand::query()->firstOrCreate(['name' => 'Michelin'], ['is_active' => true]);

        $this->supplier = Supplier::query()->create([
            'name' => 'Fournisseur Réception',
            'user_id' => $this->user->id,
        ]);

        $this->product = Product::query()->create([
            'reference' => 'REF-RECV-'.fake()->unique()->numerify('####'),
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

        // Deux dépôts de réception : chaque ligne entre dans le sien.
        $this->stock = Stock::query()->create([
            'product_id' => $this->product->id,
            'quantity' => 10,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);
        $this->otherStock = Stock::query()->create([
            'product_id' => $this->product->id,
            'quantity' => 3,
            'purchase_price' => 100,
            'user_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user, [], 'web');
    }

    // ── Les quatre cas de la règle ─────────────────────────────────────────

    public function test_creating_an_expected_purchase_leaves_stock_untouched(): void
    {
        $response = $this->postJson('/api/purchases', $this->payload('EN COURS'))->assertCreated();

        $this->assertSame(10, $this->stock->fresh()->quantity);
        $this->assertSame(3, $this->otherStock->fresh()->quantity);
        $this->assertDatabaseMissing('stock_movements', ['reference_id' => $response->json('id'), 'type' => StockMovement::TYPE_PURCHASE_IN]);
        $this->assertDatabaseHas('purchases', [
            'id' => $response->json('id'),
            'status' => 'EN COURS',
            'stock_applied' => false,
            'received_at' => null,
        ]);
        // Les quantités restent sur l'achat.
        $this->assertDatabaseHas('purchase_items', ['purchase_id' => $response->json('id'), 'stock_id' => $this->stock->id, 'quantity' => 4]);
    }

    public function test_receiving_puts_each_line_into_its_depot_and_dates_the_reception(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $this->postJson("/api/purchases/{$id}/receive", ['received_at' => '2026-09-20'])
            ->assertOk()
            ->assertJsonPath('status', 'RECU');

        $this->assertSame(14, $this->stock->fresh()->quantity);
        $this->assertSame(5, $this->otherStock->fresh()->quantity);
        $this->assertSame(2, StockMovement::query()->where('reference_id', $id)->where('type', StockMovement::TYPE_PURCHASE_IN)->count());

        $purchase = Purchase::find($id);
        $this->assertSame('RECU', $purchase->status);
        $this->assertTrue($purchase->stock_applied);
        $this->assertSame('2026-09-20', $purchase->received_at->toDateString());
    }

    public function test_receiving_twice_is_refused_and_stock_enters_once(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');
        $this->postJson("/api/purchases/{$id}/receive")->assertOk();

        $this->postJson("/api/purchases/{$id}/receive")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status')
            ->assertJsonPath('errors.status.0', 'Cet achat est déjà reçu.');

        $this->assertSame(14, $this->stock->fresh()->quantity);
        $this->assertSame(5, $this->otherStock->fresh()->quantity);
    }

    public function test_creating_a_received_purchase_puts_stock_in_at_once(): void
    {
        $response = $this->postJson('/api/purchases', $this->payload('RECU'))
            ->assertCreated()
            ->assertJsonPath('status', 'RECU');

        $this->assertSame(14, $this->stock->fresh()->quantity);
        $this->assertSame(5, $this->otherStock->fresh()->quantity);

        $purchase = Purchase::find($response->json('id'));
        $this->assertTrue($purchase->stock_applied);
        $this->assertSame(BusinessDate::today(), $purchase->received_at->toDateString());
    }

    // ── Les bords ──────────────────────────────────────────────────────────

    public function test_receiving_without_a_date_uses_today(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $this->postJson("/api/purchases/{$id}/receive")->assertOk();

        $this->assertSame(BusinessDate::today(), Purchase::find($id)->received_at->toDateString());
    }

    public function test_reception_date_cannot_be_in_the_future(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $this->postJson("/api/purchases/{$id}/receive", ['received_at' => Carbon::parse(BusinessDate::today())->addDay()->toDateString()])
            ->assertStatus(422)
            ->assertJsonValidationErrors('received_at');

        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_a_cancelled_purchase_cannot_be_received(): void
    {
        $purchase = $this->makePurchase(['status' => 'ANNULE', 'stock_applied' => false]);

        $this->postJson("/api/purchases/{$purchase->id}/receive")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_receiving_requires_edit_purchases_permission(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $viewer = User::query()->create([
            'name' => 'Lecteur',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $viewer->givePermissionTo(['view purchases']);
        // The admin is still cached by the guard from the request above.
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($viewer, [], 'web');

        $this->postJson("/api/purchases/{$id}/receive")->assertForbidden();
        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_an_expected_purchase_created_before_the_rule_is_not_counted_twice(): void
    {
        // Achat « En cours » d'avant la règle : son stock est déjà entré.
        $purchase = $this->makePurchase(['status' => 'EN COURS', 'stock_applied' => true]);

        $this->postJson("/api/purchases/{$purchase->id}/receive")->assertOk();

        $this->assertSame(10, $this->stock->fresh()->quantity);
        $this->assertSame('RECU', $purchase->fresh()->status);
    }

    public function test_editing_or_deleting_an_expected_purchase_never_touches_stock(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $this->putJson("/api/purchases/{$id}", $this->payload('EN COURS', [
            ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 9, 'unit_price' => 100],
        ]))->assertOk();
        $this->assertSame(10, $this->stock->fresh()->quantity);

        $this->deleteJson("/api/purchases/{$id}")->assertNoContent();
        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_editing_or_deleting_a_received_purchase_still_corrects_stock(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('RECU'))->json('id');
        $this->assertSame(14, $this->stock->fresh()->quantity);

        $this->putJson("/api/purchases/{$id}", $this->payload('RECU', [
            ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 1, 'unit_price' => 100],
        ]))->assertOk();
        $this->assertSame(11, $this->stock->fresh()->quantity);
        $this->assertSame(3, $this->otherStock->fresh()->quantity);

        $this->deleteJson("/api/purchases/{$id}")->assertNoContent();
        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_a_supplier_return_on_an_expected_purchase_is_refused(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');
        $itemId = DB::table('purchase_items')->where('purchase_id', $id)->value('id');

        $this->postJson("/api/purchases/{$id}/returns", [
            'date' => '2026-09-20',
            'items' => [['purchase_item_id' => $itemId, 'quantity' => 1]],
        ])->assertStatus(422)->assertJsonValidationErrors('purchase');

        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_expected_quantities_are_shown_apart_and_leave_on_reception(): void
    {
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        // La liste des lots (fiche produit) : l'attendu à part, le stock intact.
        $lots = collect($this->getJson("/api/stocks?product_id={$this->product->id}&per_page=50")->assertOk()->json('data'))->keyBy('id');
        $this->assertSame(10, $lots[$this->stock->id]['quantity']);
        $this->assertSame(4, $lots[$this->stock->id]['expected_quantity']);
        $this->assertSame(2, $lots[$this->otherStock->id]['expected_quantity']);

        // Le stock groupé : la référence totalise ses lots.
        $group = collect($this->getJson('/api/stocks-grouped?search='.$this->product->reference.'&per_page=50')->assertOk()->json('data'))
            ->firstWhere('product_id', $this->product->id);
        $this->assertSame(13, $group['quantity']);
        $this->assertSame(6, $group['expected_quantity']);

        $this->postJson("/api/purchases/{$id}/receive")->assertOk();

        $group = collect($this->getJson('/api/stocks-grouped?search='.$this->product->reference.'&per_page=50')->json('data'))
            ->firstWhere('product_id', $this->product->id);
        $this->assertSame(19, $group['quantity']);
        $this->assertSame(0, $group['expected_quantity']);
    }

    public function test_an_expected_purchase_created_before_the_rule_is_not_shown_as_expected(): void
    {
        $this->makePurchase(['status' => 'EN COURS', 'stock_applied' => true]);

        $lots = collect($this->getJson("/api/stocks?product_id={$this->product->id}&per_page=50")->json('data'))->keyBy('id');
        $this->assertSame(0, $lots[$this->stock->id]['expected_quantity']);
    }

    // ── L'heure du Maroc ───────────────────────────────────────────────────

    /**
     * 15 janvier 2026, 23 h 30 UTC : le Maroc est à UTC+1, il est déjà 0 h 30
     * le 16. Une réception datée du 16 est d'aujourd'hui, pas du futur ; sans
     * date, elle prend le 16.
     */
    public function test_reception_today_is_the_day_in_morocco_not_in_utc(): void
    {
        $this->travelTo(Carbon::parse('2026-01-15 23:30:00', 'UTC'));
        $this->assertSame('2026-01-16', BusinessDate::today());

        $dated = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');
        $this->postJson("/api/purchases/{$dated}/receive", ['received_at' => '2026-01-16'])->assertOk();
        $this->assertSame('2026-01-16', Purchase::find($dated)->received_at->toDateString());

        $undated = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');
        $this->postJson("/api/purchases/{$undated}/receive")->assertOk();
        $this->assertSame('2026-01-16', Purchase::find($undated)->received_at->toDateString());
    }

    public function test_the_day_after_in_morocco_is_still_the_future(): void
    {
        $this->travelTo(Carbon::parse('2026-01-15 23:30:00', 'UTC'));
        $id = $this->postJson('/api/purchases', $this->payload('EN COURS'))->json('id');

        $this->postJson("/api/purchases/{$id}/receive", ['received_at' => '2026-01-17'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('received_at');
        $this->assertSame(10, $this->stock->fresh()->quantity);
    }

    public function test_a_purchase_created_received_takes_the_day_in_morocco(): void
    {
        $this->travelTo(Carbon::parse('2026-01-15 23:30:00', 'UTC'));
        $id = $this->postJson('/api/purchases', $this->payload('RECU'))->assertCreated()->json('id');

        $this->assertSame('2026-01-16', Purchase::find($id)->received_at->toDateString());
    }

    public function test_business_date_endpoint_gives_the_day_in_morocco(): void
    {
        $this->travelTo(Carbon::parse('2026-01-15 23:30:00', 'UTC'));

        $this->getJson('/api/business-date')
            ->assertOk()
            ->assertExactJson(['date' => '2026-01-16', 'timezone' => 'Africa/Casablanca']);
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    /**
     * @param  array<int, array<string, mixed>>|null  $items
     * @return array<string, mixed>
     */
    private function payload(string $status, ?array $items = null): array
    {
        return [
            'date' => '2026-09-15',
            'with_invoice' => true,
            'supplier_id' => $this->supplier->id,
            'commercial_id' => $this->user->id,
            'status' => $status,
            'payment_status' => 'NON PAYE',
            'items' => $items ?? [
                ['product_id' => $this->product->id, 'stock_id' => $this->stock->id, 'quantity' => 4, 'unit_price' => 100],
                ['product_id' => $this->product->id, 'stock_id' => $this->otherStock->id, 'quantity' => 2, 'unit_price' => 100],
            ],
        ];
    }

    /**
     * Un achat écrit directement en base, pour les états qu'on ne peut pas
     * obtenir par l'API d'aujourd'hui (un achat d'avant la règle).
     *
     * @param  array<string, mixed>  $attributes
     */
    private function makePurchase(array $attributes): Purchase
    {
        $purchase = Purchase::query()->create(array_merge([
            'date' => '2026-04-01',
            'supplier_id' => $this->supplier->id,
            'commercial_id' => $this->user->id,
            'total_quantity' => 4,
            'total_price' => 400.00,
            'net_amount' => 400.00,
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ], $attributes));

        $purchase->items()->create([
            'product_id' => $this->product->id,
            'stock_id' => $this->stock->id,
            'quantity' => 4,
            'unit_price' => 100,
        ]);

        return $purchase;
    }
}
