<?php

namespace Tests\Feature;

use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PurchaseGroupedApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private Supplier $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::findOrCreate('view purchases', 'web');

        $this->user = User::query()->create([
            'name' => 'Purchase Grouped Test',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000080',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->givePermissionTo('view purchases');

        $this->supplier = Supplier::query()->create([
            'name' => 'FOURNISSEUR GROUPE TEST '.fake()->unique()->numerify('###'),
            'payment_terms_days' => 60,
            'user_id' => $this->user->id,
        ]);
    }

    public function test_grouped_requires_view_purchases_permission(): void
    {
        $guest = User::query()->create([
            'name' => 'No Purchase Permission',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000081',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/purchases-grouped')->assertForbidden();
    }

    public function test_purchases_are_grouped_under_their_supplier_with_terms_and_due_total(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->makePurchase(5000, 10);
        $this->makePurchase(3000, 100);

        $group = $this->fetchGroup(['per_page' => 200]);

        $this->assertNotNull($group);
        $this->assertSame(60, $group['terms_days']);
        $this->assertSame(2, $group['purchases_count']);
        $this->assertSame(2, $group['due_count']);
        $this->assertEquals(8000, $group['due_total']);
        $this->assertSame(100, $group['oldest_days']);
    }

    public function test_days_left_follows_the_supplier_contractual_terms(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $purchase = $this->makePurchase(1000, 20);

        $group = $this->fetchGroup(['per_page' => 200]);
        $row = collect($group['purchases'])->firstWhere('id', $purchase->id);

        $this->assertSame(20, $row['days']);
        $this->assertSame(40, $row['days_left'], '60 jours de délai moins 20 jours écoulés.');
    }

    public function test_days_left_is_null_without_contractual_terms(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $this->supplier->update(['payment_terms_days' => null]);
        $purchase = $this->makePurchase(1000, 20);

        $group = $this->fetchGroup(['per_page' => 200]);
        $row = collect($group['purchases'])->firstWhere('id', $purchase->id);

        $this->assertNull($row['days_left']);
    }

    public function test_partial_payment_lowers_the_remaining(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $purchase = $this->makePurchase(4000, 15);
        $this->payPartially($purchase, 1500);

        $group = $this->fetchGroup(['per_page' => 200]);
        $row = collect($group['purchases'])->firstWhere('id', $purchase->id);

        $this->assertEquals(2500, $row['remaining']);
        $this->assertEquals(1500, $row['paid_amount']);
    }

    public function test_settlement_filters_split_due_old_and_paid(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $recent = $this->makePurchase(1000, 10);
        $old = $this->makePurchase(2000, 150);
        $paid = $this->makePurchase(3000, 30);
        $paid->update(['payment_status' => 'PAYE']);

        $due = collect($this->fetchGroup(['per_page' => 200, 'settlement' => 'due'])['purchases'])->pluck('id');
        $this->assertContains($recent->id, $due);
        $this->assertContains($old->id, $due);
        $this->assertNotContains($paid->id, $due);

        $risk = collect($this->fetchGroup(['per_page' => 200, 'settlement' => 'legal_risk'])['purchases'])->pluck('id');
        $this->assertContains($old->id, $risk);
        $this->assertNotContains($recent->id, $risk);

        $settled = collect($this->fetchGroup(['per_page' => 200, 'settlement' => 'paid'])['purchases'])->pluck('id');
        $this->assertContains($paid->id, $settled);
    }

    public function test_cancelled_purchases_are_left_out_like_everywhere_else(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $cancelled = $this->makePurchase(9000, 20);
        $cancelled->update(['status' => 'ANNULE']);

        $group = $this->fetchGroup(['per_page' => 200]);

        if ($group !== null) {
            $this->assertNotContains($cancelled->id, collect($group['purchases'])->pluck('id'));
        } else {
            $this->assertTrue(true, 'Aucun groupe : l\'achat annulé est bien absent.');
        }
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function fetchGroup(array $query): ?array
    {
        $response = $this->getJson('/api/purchases-grouped?'.http_build_query($query));
        $response->assertOk();

        return collect($response->json('data'))->firstWhere('supplier_id', $this->supplier->id);
    }

    private function makePurchase(float $amount, int $ageDays): Purchase
    {
        return Purchase::query()->create([
            'date' => Carbon::today()->subDays($ageDays)->toDateString(),
            'supplier_id' => $this->supplier->id,
            'total_quantity' => 1,
            'total_price' => $amount,
            'net_amount' => $amount,
            'discount' => 0,
            'status' => 'RECU',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
    }

    private function payPartially(Purchase $purchase, float $amount): void
    {
        $payment = PurchasePayment::query()->create([
            'purchase_id' => null,
            'supplier_id' => $this->supplier->id,
            'amount' => $amount,
            'date' => Carbon::today()->toDateString(),
            'method' => 'Espèces',
        ]);

        PurchasePaymentAllocation::query()->create([
            'purchase_payment_id' => $payment->id,
            'purchase_id' => $purchase->id,
            'amount' => $amount,
        ]);

        $purchase->update(['payment_status' => 'PARTIEL']);
    }
}
