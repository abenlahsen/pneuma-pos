<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use App\Models\PurchasePaymentAllocation;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CashFlowProjectionApiTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::findOrCreate('view cash-flow', 'web');

        $this->user = User::query()->create([
            'name' => 'Projection Test Admin',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        $this->user->givePermissionTo('view cash-flow');
    }

    public function test_projection_requires_authentication(): void
    {
        $this->getJson('/api/transactions-projection')->assertUnauthorized();
    }

    public function test_projection_requires_view_cash_flow_permission(): void
    {
        $guest = User::query()->create([
            'name' => 'No Permission User',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        Sanctum::actingAs($guest, [], 'web');

        $this->getJson('/api/transactions-projection')->assertForbidden();
    }

    public function test_projection_returns_expected_structure(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk()->assertJsonStructure([
            'today_balance',
            'weeks',
            'low_point',
            'in_play' => ['supplier_due', 'client_due', 'net_position'],
            'expenses_by_category',
            'recurring_weekly_estimate',
        ]);
        $this->assertCount(6, $response->json('weeks'));
    }

    public function test_projection_buckets_unpaid_purchase_using_supplier_contractual_terms(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $supplier = Supplier::query()->create(['name' => 'Fournisseur Délai Test', 'payment_terms_days' => 14, 'user_id' => $this->user->id]);
        Purchase::query()->create([
            'date' => Carbon::today()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 1000,
            'net_amount' => 1000,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $expectedIndex = $this->weekIndexFor(Carbon::today()->addDays(14));

        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk();
        $this->assertEquals(1000.0, $response->json('in_play.supplier_due'));
        $this->assertEquals(1000.0, $response->json("weeks.{$expectedIndex}.outflow") - $response->json("recurring_weekly_estimate"));
    }

    public function test_projection_falls_back_to_default_delay_when_supplier_has_no_terms(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $supplier = Supplier::query()->create(['name' => 'Fournisseur Sans Délai', 'payment_terms_days' => null, 'user_id' => $this->user->id]);
        Purchase::query()->create([
            'date' => Carbon::today()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 1,
            'total_price' => 500,
            'net_amount' => 500,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $expectedIndex = $this->weekIndexFor(Carbon::today()->addDays(30));

        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk();
        $outflowMinusRecurring = $response->json("weeks.{$expectedIndex}.outflow") - $response->json('recurring_weekly_estimate');
        $this->assertEquals(500.0, $outflowMinusRecurring);
    }

    public function test_projection_uses_client_real_delay_over_contractual_terms(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        // Contrat : 10 jours. Historique réel observé : 45 jours (deux ventes soldées).
        $client = Client::query()->create([
            'name' => 'Client Délai Réel Test',
            'phone' => '0600000099',
            'category' => 'Particulier',
            'payment_terms_days' => 10,
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
            'is_active' => true,
        ]);

        foreach ([1, 2] as $i) {
            $saleDate = Carbon::today()->subDays(200 + $i);
            $paidSale = Sale::query()->create([
                'date' => $saleDate->toDateString(),
                'client_id' => $client->id,
                'total_quantity' => 1,
                'total_purchase' => 50,
                'total_sale' => 100,
                'margin' => 50,
                'status' => 'TERMINEE',
                'payment_status' => 'PAYE',
                'created_by' => $this->user->id,
            ]);
            $payment = Payment::query()->create([
                'sale_id' => $paidSale->id,
                'client_id' => $client->id,
                'amount' => 100,
                'date' => $saleDate->copy()->addDays(45)->toDateString(),
                'method' => 'Espèces',
                'user_id' => $this->user->id,
            ]);
            SalePaymentAllocation::query()->create(['payment_id' => $payment->id, 'sale_id' => $paidSale->id, 'amount' => 100]);
        }

        $unpaidSale = Sale::query()->create([
            'date' => Carbon::today()->toDateString(),
            'client_id' => $client->id,
            'total_quantity' => 1,
            'total_purchase' => 100,
            'total_sale' => 2000,
            'margin' => 100,
            'status' => 'EN COURS',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);

        $expectedIndexRealDelay = $this->weekIndexFor(Carbon::today()->addDays(45));
        $expectedIndexContractual = $this->weekIndexFor(Carbon::today()->addDays(10));

        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk();
        $this->assertEquals(2000.0, $response->json('in_play.client_due'));
        $this->assertEquals(2000.0, (float) $response->json("weeks.{$expectedIndexRealDelay}.inflow"));

        if ($expectedIndexContractual !== $expectedIndexRealDelay) {
            $this->assertEquals(0.0, (float) $response->json("weeks.{$expectedIndexContractual}.inflow"));
        }
    }

    public function test_projection_in_play_matches_effective_purchase_outstanding_after_return(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $supplier = Supplier::query()->create(['name' => 'Fournisseur Avec Retour', 'payment_terms_days' => 7, 'user_id' => $this->user->id]);
        $account = Account::query()->create([
            'name' => 'Compte Projection Test',
            'type' => 'cash',
            'initial_balance' => 0,
            'is_active' => true,
        ]);
        $purchase = Purchase::query()->create([
            'date' => Carbon::today()->toDateString(),
            'supplier_id' => $supplier->id,
            'total_quantity' => 2,
            'total_price' => 1000,
            'net_amount' => 1000,
            'discount' => 0,
            'status' => 'EN COURS',
            'payment_status' => 'PARTIEL',
            'created_by' => $this->user->id,
        ]);

        $tx = \App\Models\Transaction::query()->create([
            'account_id' => $account->id,
            'date' => Carbon::today()->toDateString(),
            'amount' => 300,
            'type' => 'expense',
            'category' => 'Achat marchandise',
            'method' => 'Espèces',
            'description' => 'Acompte achat test',
            'user_id' => $this->user->id,
        ]);
        $payment = PurchasePayment::query()->create([
            'purchase_id' => null,
            'supplier_id' => $supplier->id,
            'transaction_id' => $tx->id,
            'amount' => 300,
            'date' => Carbon::today()->toDateString(),
            'method' => 'Espèces',
        ]);
        PurchasePaymentAllocation::query()->create(['purchase_payment_id' => $payment->id, 'purchase_id' => $purchase->id, 'amount' => 300]);

        // Reste dû = 1000 (net) - 300 (payé) = 700.
        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk();
        $this->assertEquals(700.0, $response->json('in_play.supplier_due'));
    }

    public function test_projection_includes_pending_cheque_at_its_due_date(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = Account::query()->create([
            'name' => 'Compte Chèque Test',
            'type' => 'bank',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        $dueDate = Carbon::today()->addDays(9);
        \App\Models\Transaction::query()->create([
            'account_id' => $account->id,
            'date' => $dueDate->toDateString(),
            'amount' => 4200,
            'type' => 'expense',
            'category' => 'Achat marchandise',
            'method' => 'Chèque',
            'description' => 'Chèque à encaisser test',
            'user_id' => $this->user->id,
        ]);

        $expectedIndex = $this->weekIndexFor($dueDate);

        $response = $this->getJson('/api/transactions-projection');

        $response->assertOk();
        $outflowMinusRecurring = $response->json("weeks.{$expectedIndex}.outflow") - $response->json('recurring_weekly_estimate');
        $this->assertEquals(4200.0, $outflowMinusRecurring);
    }

    public function test_recurring_estimate_excludes_purchase_payments(): void
    {
        Sanctum::actingAs($this->user, [], 'web');

        $account = Account::query()->create([
            'name' => 'Compte Récurrent Test',
            'type' => 'bank',
            'initial_balance' => 0,
            'is_active' => true,
        ]);

        // Mois plein précédent : un règlement d'achat (déjà projeté par ailleurs)
        // ne doit pas gonfler la moyenne des charges récurrentes.
        $lastMonth = Carbon::today()->startOfMonth()->subDays(5);
        \App\Models\Transaction::query()->create([
            'account_id' => $account->id,
            'date' => $lastMonth->toDateString(),
            'amount' => 90000,
            'type' => 'expense',
            'category' => 'Achat marchandise',
            'method' => 'Espèces',
            'description' => 'Règlement achat test',
            'user_id' => $this->user->id,
        ]);

        $before = $this->getJson('/api/transactions-projection')->json('recurring_weekly_estimate');

        \App\Models\Transaction::query()->create([
            'account_id' => $account->id,
            'date' => $lastMonth->toDateString(),
            'amount' => 13035,
            'type' => 'expense',
            'category' => 'Loyer',
            'method' => 'Virement',
            'description' => 'Loyer test',
            'user_id' => $this->user->id,
        ]);

        $after = $this->getJson('/api/transactions-projection')->json('recurring_weekly_estimate');

        // 13 035 / 3 mois / 4,345 semaines ≈ 1 000 DH par semaine.
        $this->assertEquals(1000.0, round($after - $before));
    }

    private function weekIndexFor(Carbon $date): int
    {
        $weekStart = Carbon::today()->startOfWeek(Carbon::MONDAY);
        $index = (int) floor($weekStart->diffInDays($date, false) / 7);

        return max(0, min(5, $index));
    }
}
