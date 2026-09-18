<?php

namespace Tests\Feature;

use App\Domain\Clients\ClientDebtService;
use App\Models\Client;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\SalePaymentAllocation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class ClientDebtServiceTest extends TestCase
{
    use DatabaseTransactions;

    private User $user;
    private ClientDebtService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ClientDebtService::class);
        $this->user = User::query()->create([
            'name' => 'Client Debt Test',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000070',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
    }

    public function test_aging_splits_the_debt_by_age_and_matches_its_total(): void
    {
        $client = $this->makeClient(['credit_limit' => 20000]);

        $this->makeUnpaidSale($client, 1000, 10);   // 0-30
        $this->makeUnpaidSale($client, 2000, 45);   // 31-60
        $this->makeUnpaidSale($client, 3000, 75);   // 61-90
        $this->makeUnpaidSale($client, 4000, 200);  // 90+

        $aging = $this->service->aging($client->fresh());

        $this->assertEquals(1000, $aging['buckets']['0-30']);
        $this->assertEquals(2000, $aging['buckets']['31-60']);
        $this->assertEquals(3000, $aging['buckets']['61-90']);
        $this->assertEquals(4000, $aging['buckets']['90+']);
        $this->assertEquals(10000, $aging['total']);
        $this->assertEquals(array_sum($aging['buckets']), $aging['total']);
        $this->assertEquals(10000, $aging['credit_left'], 'Limite 20 000 moins 10 000 dus.');
    }

    public function test_aging_counts_only_what_is_still_due(): void
    {
        $client = $this->makeClient();

        $sale = $this->makeUnpaidSale($client, 5000, 20);
        $this->payPartially($client, $sale, 1500);

        $aging = $this->service->aging($client->fresh());

        $this->assertEquals(3500, $aging['buckets']['0-30']);
        $this->assertEquals(3500, $aging['total']);
    }

    public function test_credit_left_is_null_without_a_limit(): void
    {
        $client = $this->makeClient(['credit_limit' => 0]);
        $this->makeUnpaidSale($client, 1000, 5);

        $aging = $this->service->aging($client->fresh());

        $this->assertNull($aging['credit_left'], 'Sans limite fixée, le crédit restant n\'a pas de valeur.');
    }

    public function test_observed_delay_reads_the_history(): void
    {
        $client = $this->makeClient(['payment_terms_days' => 15]);

        foreach ([40, 50] as $index => $delay) {
            $this->makeSettledSale($client, 1000, 300 + $index, $delay);
        }

        $delay = $this->service->paymentDelay($client->fresh());

        $this->assertSame(15, $delay['contractual_days']);
        $this->assertSame(45, $delay['observed_days'], 'Moyenne de 40 et 50 jours.');
        $this->assertSame(2, $delay['observed_sample']);
    }

    public function test_observed_delay_needs_enough_history(): void
    {
        $client = $this->makeClient(['payment_terms_days' => 15]);
        $this->makeSettledSale($client, 1000, 300, 42);

        $delay = $this->service->paymentDelay($client->fresh());

        $this->assertNull($delay['observed_days'], 'Une seule vente soldée ne fait pas une moyenne.');
        $this->assertSame(1, $delay['observed_sample']);
    }

    public function test_projection_delay_prefers_history_then_contract(): void
    {
        $withHistory = $this->makeClient(['payment_terms_days' => 15]);
        foreach ([60, 60] as $index => $delay) {
            $this->makeSettledSale($withHistory, 1000, 400 + $index, $delay);
        }

        $contractOnly = $this->makeClient(['payment_terms_days' => 21]);

        $this->assertSame(60, $this->service->projectionDelayDays($withHistory->id, $withHistory->fresh()));
        $this->assertSame(21, $this->service->projectionDelayDays($contractOnly->id, $contractOnly->fresh()));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeClient(array $attributes = []): Client
    {
        return Client::query()->create(array_merge([
            'name' => 'Client Dette '.fake()->unique()->numerify('###'),
            'phone' => '06'.fake()->unique()->numerify('########'),
            'category' => 'Entreprise',
            'created_by' => $this->user->id,
            'updated_by' => $this->user->id,
            'is_active' => true,
        ], $attributes));
    }

    private function makeUnpaidSale(Client $client, float $amount, int $ageDays): Sale
    {
        return Sale::query()->create([
            'date' => Carbon::today()->subDays($ageDays)->toDateString(),
            'client_id' => $client->id,
            'total_quantity' => 1,
            'total_purchase' => 0,
            'total_sale' => $amount,
            'margin' => $amount,
            'status' => 'LIVRE',
            'payment_status' => 'NON PAYE',
            'created_by' => $this->user->id,
        ]);
    }

    private function makeSettledSale(Client $client, float $amount, int $ageDays, int $paidAfterDays): void
    {
        $saleDate = Carbon::today()->subDays($ageDays);

        $sale = Sale::query()->create([
            'date' => $saleDate->toDateString(),
            'client_id' => $client->id,
            'total_quantity' => 1,
            'total_purchase' => 0,
            'total_sale' => $amount,
            'margin' => $amount,
            'status' => 'TERMINEE',
            'payment_status' => 'PAYE',
            'created_by' => $this->user->id,
        ]);

        $payment = Payment::query()->create([
            'sale_id' => $sale->id,
            'client_id' => $client->id,
            'amount' => $amount,
            'date' => $saleDate->copy()->addDays($paidAfterDays)->toDateString(),
            'method' => 'Virement',
            'user_id' => $this->user->id,
        ]);

        SalePaymentAllocation::query()->create([
            'payment_id' => $payment->id,
            'sale_id' => $sale->id,
            'amount' => $amount,
        ]);
    }

    private function payPartially(Client $client, Sale $sale, float $amount): void
    {
        $payment = Payment::query()->create([
            'sale_id' => $sale->id,
            'client_id' => $client->id,
            'amount' => $amount,
            'date' => Carbon::today()->subDays(2)->toDateString(),
            'method' => 'Espèces',
            'user_id' => $this->user->id,
        ]);

        SalePaymentAllocation::query()->create([
            'payment_id' => $payment->id,
            'sale_id' => $sale->id,
            'amount' => $amount,
        ]);

        $sale->update(['payment_status' => 'PARTIEL']);
    }
}
