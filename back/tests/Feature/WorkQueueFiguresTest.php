<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Colonne laterale de l'accueil (`5a`/`5b`) — « mes chiffres » du commercial,
 * « toutes agences » du gerant.
 *
 * Meme regle que les files : la portee est appliquee dans la requete. Un
 * commercial ne doit pas recevoir le chiffre d'affaires de ses collegues,
 * meme agrege — un total d'agence permet de deduire ce qu'on ne doit pas voir
 * des qu'on connait ses propres chiffres.
 */
class WorkQueueFiguresTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['view sales', 'view service-orders', 'view unpaid.all', 'view reporting.all'] as $permission) {
            Permission::findOrCreate($permission, 'web');
        }
    }

    private function makeUser(array $permissions): User
    {
        $user = User::query()->create([
            'name' => 'User '.fake()->unique()->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $user->givePermissionTo($permissions);
        Sanctum::actingAs($user, [], 'web');

        return $user;
    }

    private function sale(User $commercial, string $date, float $amount, float $margin = 0): Sale
    {
        return Sale::query()->create([
            'date' => $date,
            'client_id' => Client::query()->create(['name' => 'Client '.fake()->unique()->numerify('###'), 'category' => 'Particulier', 'is_active' => true])->id,
            'commercial_id' => $commercial->id,
            'total_quantity' => 1,
            'total_purchase' => $amount - $margin,
            'total_sale' => $amount,
            'margin' => $margin,
            'status' => 'LIVRE',
            'payment_status' => 'PAYÉ',
            'created_by' => $commercial->id,
        ]);
    }

    public function test_a_commercial_only_gets_his_own_figures(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $commercial = $this->makeUser(['view sales', 'view service-orders']);

        $this->sale($commercial, now()->toDateString(), 1000, 300);
        $this->sale($colleague, now()->toDateString(), 5000, 2000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk()->assertJsonPath('figures.scope', 'own');
        $this->assertEqualsWithDelta(1000, $response->json('figures.today.revenue'), 0.01);
        $this->assertSame(1, $response->json('figures.today.sales'));
    }

    /**
     * Le commercial se situe sans voir personne : la moyenne par commercial
     * lui dit s'il est au-dessus ou en dessous, sans nommer qui que ce soit
     * (tableau de portee du README, ligne « Chiffres lateraux »).
     */
    public function test_a_commercial_gets_the_agency_average_alongside_his_own(): void
    {
        $others = [];
        foreach (['A', 'B'] as $name) {
            $others[] = User::query()->create([
                'name' => 'Collegue '.$name,
                'email' => fake()->unique()->safeEmail(),
                'password' => 'password',
                'phone' => '0600000001',
                'commission_rate' => 0,
                'must_change_password' => false,
            ]);
        }

        $commercial = $this->makeUser(['view sales']);

        $this->sale($commercial, now()->toDateString(), 1000);
        $this->sale($others[0], now()->toDateString(), 5000);
        $this->sale($others[1], now()->toDateString(), 3000);

        $response = $this->getJson('/api/work-queues');

        // 9 000 sur trois commerciaux : il sait qu'il est sous la moyenne.
        $response->assertOk()->assertJsonPath('figures.scope', 'own');
        $this->assertEqualsWithDelta(3000, $response->json('figures.month.agency_average'), 0.01);
    }

    /**
     * A deux commerciaux, moyenne + ses propres chiffres = le chiffre exact du
     * collegue. On la supprime : le but est de se situer, pas de deduire.
     */
    public function test_the_agency_average_is_withheld_when_it_would_expose_a_colleague(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue seul',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $commercial = $this->makeUser(['view sales']);

        $this->sale($commercial, now()->toDateString(), 1000);
        $this->sale($colleague, now()->toDateString(), 5000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $this->assertNull($response->json('figures.month.agency_average'));
    }

    // ── Colonne laterale : quatre lignes, pas deux cadrans ─────────────────

    public function test_the_side_figures_carry_the_day_margin_and_open_orders(): void
    {
        $commercial = $this->makeUser(['view sales']);
        $this->sale($commercial, now()->toDateString(), 1000, 300);
        $this->sale($commercial, now()->toDateString(), 2000, 500);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $this->assertEqualsWithDelta(800, $response->json('figures.today.margin'), 0.01);
        $this->assertSame(0, $response->json('figures.today.open_orders'));
    }

    /**
     * Trente barres exigent trente valeurs : un jour sans vente est un creux,
     * pas un trou. C'est precisement ce qu'une courbe lissee cachait.
     */
    public function test_the_trend_always_carries_thirty_days_including_empty_ones(): void
    {
        $manager = $this->makeUser(['view sales', 'view reporting.all']);
        $this->sale($manager, now()->toDateString(), 1000);

        $response = $this->getJson('/api/work-queues');

        $trend = $response->json('figures.trend');
        $this->assertCount(30, $trend);
        $this->assertSame(today()->subDays(29)->toDateString(), $trend[0]['date']);
        $this->assertSame(today()->toDateString(), $trend[29]['date']);
        $this->assertEqualsWithDelta(1000, $trend[29]['revenue'], 0.01);
    }

    // ── Objectif mensuel ───────────────────────────────────────────────────

    public function test_the_commercial_gets_his_monthly_target(): void
    {
        $commercial = $this->makeUser(['view sales']);
        $commercial->forceFill(['monthly_target' => 400000])->save();

        $response = $this->getJson('/api/work-queues');

        $this->assertEqualsWithDelta(400000, $response->json('figures.month.target'), 0.01);
    }

    /** Pas d'objectif fixe : pas de barre. Mieux vaut rien qu'une barre a 0 %. */
    public function test_no_target_means_no_progress_bar(): void
    {
        $this->makeUser(['view sales']);

        $response = $this->getJson('/api/work-queues');

        $this->assertNull($response->json('figures.month.target'));
    }

    /** Le gerant n'a pas d'objectif personnel : la barre ne le concerne pas. */
    public function test_the_target_is_absent_from_the_agency_scope(): void
    {
        $manager = $this->makeUser(['view sales', 'view reporting.all']);
        $manager->forceFill(['monthly_target' => 400000])->save();

        $response = $this->getJson('/api/work-queues');

        $response->assertJsonPath('figures.scope', 'all');
        $this->assertNull($response->json('figures.month.target'));
    }

    /** Le gerant voit le nominatif : la moyenne ne lui apprend rien. */
    public function test_the_agency_average_is_absent_from_the_agency_scope(): void
    {
        $manager = $this->makeUser(['view sales', 'view reporting.all']);
        $this->sale($manager, now()->toDateString(), 1000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk()->assertJsonPath('figures.scope', 'all');
        $this->assertNull($response->json('figures.month.agency_average'));
    }

    public function test_a_manager_gets_the_agency_figures(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $manager = $this->makeUser(['view sales', 'view service-orders', 'view reporting.all']);

        $this->sale($manager, now()->toDateString(), 1000, 300);
        $this->sale($colleague, now()->toDateString(), 5000, 2000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk()->assertJsonPath('figures.scope', 'all');
        $this->assertEqualsWithDelta(6000, $response->json('figures.today.revenue'), 0.01);
        $this->assertSame(2, $response->json('figures.today.sales'));
    }

    public function test_the_nominative_ranking_is_reserved_to_the_agency_scope(): void
    {
        $this->makeUser(['view sales', 'view service-orders']);

        $response = $this->getJson('/api/work-queues');

        $this->assertSame([], $response->json('figures.ranking'), 'Un commercial ne classe pas ses collegues.');
    }

    public function test_the_ranking_carries_each_commercial_unpaid_amount(): void
    {
        $manager = $this->makeUser(['view sales', 'view service-orders', 'view reporting.all']);

        $paid = $this->sale($manager, now()->toDateString(), 1000, 400);
        $unpaid = $this->sale($manager, now()->toDateString(), 2000, 500);
        $unpaid->update(['payment_status' => 'NON PAYE']);

        $response = $this->getJson('/api/work-queues');

        $row = collect($response->json('figures.ranking'))->firstWhere('id', $manager->id);

        $this->assertNotNull($row, 'Le gerant doit figurer dans son propre classement.');
        $this->assertEqualsWithDelta(3000, $row['revenue'], 0.01);
        // Un CA eleve avec un impaye eleve n'est pas une performance.
        $this->assertEqualsWithDelta(2000, $row['unpaid'], 0.01);
    }

    public function test_a_cancelled_sale_counts_nowhere(): void
    {
        $commercial = $this->makeUser(['view sales', 'view service-orders']);

        $cancelled = $this->sale($commercial, now()->toDateString(), 9999, 5000);
        $cancelled->update(['status' => 'ANNULE']);

        $response = $this->getJson('/api/work-queues');

        $this->assertEqualsWithDelta(0, $response->json('figures.today.revenue'), 0.01);
    }

    public function test_figures_are_absent_without_the_sales_permission(): void
    {
        $this->makeUser([]);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $this->assertArrayNotHasKey('figures', $response->json());
    }
}
