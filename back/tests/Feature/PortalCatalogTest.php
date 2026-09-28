<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\CompanySetting;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\Concerns\PortalFixtures;
use Tests\TestCase;

/**
 * Étape 13.2 — ce que le portail montre : catalogue, disponibilité, compte.
 */
class PortalCatalogTest extends TestCase
{
    use DatabaseTransactions;
    use PortalFixtures;

    private Client $client;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->makeStaff();
        $this->client = $this->portalClient('Garage Catalogue', ['discount_rate' => 10]);
        [, $this->token] = $this->portalSession($this->client, 'catalogue@garage.test');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ── Catalogue ──────────────────────────────────────────────────────────

    public function test_the_three_ways_of_writing_a_dimension_find_the_tyre(): void
    {
        $tyre = $this->catalogTyre('Zqxprofil', 1000, 305, 25, 23);
        $this->catalogTyre('Zqxprofil', 1000, 305, 30, 23);

        foreach (['3052523 Zqxprofil', '305/25R23 Zqxprofil', '305 25 23 Zqxprofil', '305/25 R23 Zqxprofil'] as $q) {
            $ids = collect($this->catalog($q)->json('data'))->pluck('id')->all();
            $this->assertSame([$tyre->id], $ids, "« {$q} »");
        }
        $this->assertSame('305/25R23', $this->catalog('305 25 23 Zqxprofil')->json('data.0.dimension'));
    }

    public function test_only_active_tyres_with_a_catalogue_price_are_listed(): void
    {
        $priced = $this->catalogTyre('Ywvprofil', 1000);
        $this->catalogTyre('Ywvprofil', null);
        $inactive = $this->catalogTyre('Ywvprofil', 1000);
        $inactive->update(['is_active' => false]);

        $this->assertSame([$priced->id], collect($this->catalog('Ywvprofil')->json('data'))->pluck('id')->all());
    }

    public function test_the_price_is_the_catalogue_price_minus_the_client_discount(): void
    {
        $this->catalogTyre('Prixprofil', 1250);

        $row = $this->catalog('Prixprofil')->json('data.0');
        $this->assertEquals(1250, $row['catalog_price']);
        $this->assertEquals(10, $row['discount_rate']);
        $this->assertEquals(1125, $row['price']);
    }

    public function test_the_four_availability_levels(): void
    {
        $this->threshold(8);
        $slow = $this->supplier('Fournisseur lent', 12);

        $available = $this->catalogTyre('Dispoprofil A', 1000);
        $this->lot($available, 5);
        $this->lot($available, 3);

        $limited = $this->catalogTyre('Dispoprofil B', 1000);
        $this->lot($limited, 7);

        $expected = $this->catalogTyre('Dispoprofil C', 1000);
        $this->purchase($slow, $expected, $this->lot($expected, 0), 'EN COURS', false);

        $onOrder = $this->catalogTyre('Dispoprofil D', 1000);
        $this->purchase($slow, $onOrder, $this->lot($onOrder, 0), 'RECU', true);

        $unknown = $this->catalogTyre('Dispoprofil E', 1000);

        $levels = collect($this->catalog('Dispoprofil')->json('data'))->mapWithKeys(fn ($r) => [$r['id'] => $r['availability']]);

        $this->assertSame(['level' => 'available', 'label' => 'Disponible', 'lead_days' => null], $levels[$available->id]);
        $this->assertSame(['level' => 'limited', 'label' => 'Stock limité', 'lead_days' => null], $levels[$limited->id]);
        $this->assertSame(['level' => 'within_24h', 'label' => 'Sous 24 h', 'lead_days' => 1], $levels[$expected->id]);
        $this->assertSame(['level' => 'on_order', 'label' => 'Sur commande · 12 j', 'lead_days' => 12], $levels[$onOrder->id]);
        $this->assertSame(['level' => 'on_order', 'label' => 'Sur commande · 7 j', 'lead_days' => 7], $levels[$unknown->id]);
    }

    public function test_expected_quantities_never_count_as_available(): void
    {
        $this->threshold(8);
        $tyre = $this->catalogTyre('Attenduprofil', 1000);
        $this->purchase($this->supplier('F'), $tyre, $this->lot($tyre, 2), 'EN COURS', false, 20);

        $this->assertSame('limited', $this->catalog('Attenduprofil')->json('data.0.availability.level'));
    }

    public function test_the_threshold_comes_from_the_settings(): void
    {
        $tyre = $this->catalogTyre('Seuilprofil', 1000);
        $this->lot($tyre, 3);

        $this->threshold(3);
        $this->assertSame('available', $this->catalog('Seuilprofil')->json('data.0.availability.level'));
        $this->threshold(4);
        $this->assertSame('limited', $this->catalog('Seuilprofil')->json('data.0.availability.level'));
    }

    public function test_available_only_hides_what_must_be_ordered_and_available_comes_first(): void
    {
        $this->threshold(8);
        $onOrder = $this->catalogTyre('Ordreprofil A', 1000);
        $inStock = $this->catalogTyre('Ordreprofil B', 1000);
        $this->lot($inStock, 10);

        $this->assertSame([$inStock->id, $onOrder->id], collect($this->catalog('Ordreprofil')->json('data'))->pluck('id')->all());
        $this->assertSame([$inStock->id], collect($this->catalog('Ordreprofil', ['available_only' => 1])->json('data'))->pluck('id')->all());
    }

    public function test_pages_are_capped_at_50_rows(): void
    {
        $this->portal('GET', '/api/portal/catalog?per_page=51', $this->token)->assertUnprocessable();
        $this->portal('GET', '/api/portal/catalog?season=printemps', $this->token)->assertUnprocessable();
    }

    // ── Compte ─────────────────────────────────────────────────────────────

    public function test_the_account_gives_the_balance_the_credit_left_and_the_due_dates(): void
    {
        Carbon::setTestNow('2026-09-28 10:00:00');
        // Le jeton est ouvert après avoir figé l'heure (Sanctum : 480 min).
        [, $this->token] = $this->portalSession($this->client, 'echeances@garage.test');
        $this->client->update(['credit_limit' => 10000, 'payment_terms_days' => 30, 'opening_balance' => 500]);
        $tyre = $this->catalogTyre('Compteprofil', 1000);

        $this->sale($this->client, $tyre, 3000, '2026-08-01');                 // échue le 31/08, 28 j de retard
        $partial = $this->sale($this->client, $tyre, 2000, '2026-09-10');      // échéance 10/10
        $this->pay($partial, 500, '2026-09-15');
        $this->sale($this->client, $tyre, 9999, '2026-09-11', 'ANNULE');       // annulée : ignorée

        $this->portal('GET', '/api/portal/account', $this->token)
            ->assertOk()
            ->assertJsonPath('balance_due', 500 + 3000 + 1500)
            ->assertJsonPath('credit_limit', 10000)
            ->assertJsonPath('credit_left', 5000)
            ->assertJsonPath('over_limit', false)
            ->assertJsonPath('payment_terms_days', 30)
            ->assertJsonPath('discount_rate', 10)
            ->assertJsonPath('overdue_amount', 3000)
            ->assertJsonPath('overdue_days', 28)
            ->assertJsonPath('next_due.date', '2026-10-10')
            ->assertJsonPath('next_due.amount', 1500);
    }

    public function test_the_statement_is_the_agency_statement_line_for_line(): void
    {
        $tyre = $this->catalogTyre('Releveprofil', 1000);
        $this->client->update(['opening_balance' => 250]);
        $sale = $this->sale($this->client, $tyre, 2400, '2026-09-01');
        $this->pay($sale, 1000, '2026-09-05');
        $this->sale($this->client, $tyre, 800, '2026-09-06', 'ANNULE');

        $portal = collect($this->portal('GET', '/api/portal/statement', $this->token)->assertOk()->json('data'));

        $this->staff->givePermissionTo(Permission::findOrCreate('view clients', 'web'));
        $agency = collect($this->actingAs($this->staff, 'web')->getJson("/api/clients/{$this->client->id}/statement")->assertOk()->json('data.entries'));

        $this->assertSame(
            $agency->map(fn ($e) => [$e['date'], (float) $e['debit'], (float) $e['credit'], (float) $e['balance']])->all(),
            $portal->map(fn ($e) => [$e['date'], (float) $e['debit'], (float) $e['credit'], (float) $e['balance']])->all(),
        );
        $this->assertEquals(1650, $portal->first()['balance']);
    }

    public function test_a_document_is_ready_to_print(): void
    {
        $tyre = $this->catalogTyre('Docprofil', 1000);
        $sale = $this->sale($this->client, $tyre, 2400, '2026-09-01');
        $this->pay($sale, 400, '2026-09-02');

        $this->portal('GET', "/api/portal/documents/{$sale->id}", $this->token)
            ->assertOk()
            ->assertJsonPath('kind', 'FACTURE')
            ->assertJsonPath('total', 2400)
            ->assertJsonPath('paid', 400)
            ->assertJsonPath('remaining', 2000)
            ->assertJsonPath('lines.0.quantity', 2)
            ->assertJsonPath('lines.0.unit_price', 1200)
            ->assertJsonPath('client.name', 'Garage Catalogue');
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    private function catalog(string $q, array $params = [])
    {
        return $this->portal('GET', '/api/portal/catalog?'.http_build_query(['q' => $q] + $params), $this->token)->assertOk();
    }

    private function threshold(int $value): void
    {
        $settings = CompanySetting::query()->first() ?? CompanySetting::query()->forceCreate(['company_name' => 'Pneuma']);
        $settings->forceFill(['portal_available_threshold' => $value])->save();
    }
}
