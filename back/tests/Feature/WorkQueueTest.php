<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\Product;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Files de travail de l'accueil (`5a`/`5b`).
 *
 * La regle de portee est le sujet de ces tests : sans la permission `.all`,
 * un commercial ne doit recevoir QUE ses propres lignes — et le filtrage se
 * fait cote serveur, jamais dans le front. Ces tests echouent si la requete
 * renvoie les lignes d'un collegue, meme si l'interface les masque ensuite.
 */
class WorkQueueTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ([
            'view sales', 'view service-orders', 'view stock',
            'view unpaid.all', 'view service-orders.all',
        ] as $permission) {
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

    private function makeClient(string $name): Client
    {
        return Client::query()->create([
            'name' => $name,
            'category' => 'Particulier',
            'is_active' => true,
        ]);
    }

    /** Une vente impayee rattachee a $commercial. */
    private function makeUnpaidSale(User $commercial, Client $client, float $amount = 1000): Sale
    {
        return Sale::query()->create([
            'date' => now()->toDateString(),
            'client_id' => $client->id,
            'commercial_id' => $commercial->id,
            'total_quantity' => 1,
            'total_purchase' => 0,
            'total_sale' => $amount,
            'margin' => $amount,
            'status' => 'LIVRE',
            'payment_status' => 'NON PAYE',
            'created_by' => $commercial->id,
        ]);
    }

    public function test_queues_require_authentication(): void
    {
        $response = $this->getJson('/api/work-queues');

        $response->assertUnauthorized();
    }

    public function test_commercial_only_sees_his_own_unpaid_sales(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000001',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $mine = $this->makeClient('Client A');
        $theirs = $this->makeClient('Client B');

        $commercial = $this->makeUser(['view sales', 'view service-orders']);
        $ownSale = $this->makeUnpaidSale($commercial, $mine, 1500);
        $otherSale = $this->makeUnpaidSale($colleague, $theirs, 2500);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $ids = collect($response->json('unpaid.rows'))->pluck('id')->all();

        $this->assertContains($ownSale->id, $ids);
        $this->assertNotContains($otherSale->id, $ids, "La vente d'un collegue ne doit jamais quitter le serveur.");
    }

    public function test_manager_with_all_permission_sees_every_unpaid_sale(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000002',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $client = $this->makeClient('Client C');

        $manager = $this->makeUser(['view sales', 'view service-orders', 'view unpaid.all']);
        $ownSale = $this->makeUnpaidSale($manager, $client, 1000);
        $otherSale = $this->makeUnpaidSale($colleague, $client, 3000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $ids = collect($response->json('unpaid.rows'))->pluck('id')->all();

        $this->assertContains($ownSale->id, $ids);
        $this->assertContains($otherSale->id, $ids);
    }

    public function test_queue_without_all_permission_reports_an_own_scope(): void
    {
        $this->makeUser(['view sales', 'view service-orders']);

        $this->getJson('/api/work-queues')
            ->assertOk()
            ->assertJsonPath('unpaid.scope', 'own');
    }

    public function test_queue_with_all_permission_reports_an_all_scope(): void
    {
        $this->makeUser(['view sales', 'view service-orders', 'view unpaid.all']);

        $this->getJson('/api/work-queues')
            ->assertOk()
            ->assertJsonPath('unpaid.scope', 'all');
    }

    public function test_a_paid_sale_is_not_in_the_queue(): void
    {
        $client = $this->makeClient('Client D');
        $commercial = $this->makeUser(['view sales', 'view service-orders']);

        $paid = $this->makeUnpaidSale($commercial, $client, 800);
        $paid->update(['payment_status' => 'PAYÉ']);

        $response = $this->getJson('/api/work-queues');

        $ids = collect($response->json('unpaid.rows'))->pluck('id')->all();
        $this->assertNotContains($paid->id, $ids);
    }

    public function test_a_cancelled_sale_is_not_in_the_queue(): void
    {
        $client = $this->makeClient('Client E');
        $commercial = $this->makeUser(['view sales', 'view service-orders']);

        $cancelled = $this->makeUnpaidSale($commercial, $client, 900);
        $cancelled->update(['status' => 'ANNULE']);

        $response = $this->getJson('/api/work-queues');

        $ids = collect($response->json('unpaid.rows'))->pluck('id')->all();
        $this->assertNotContains($cancelled->id, $ids);
    }

    public function test_commercial_only_sees_his_own_orders_to_invoice(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000003',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $commercial = $this->makeUser(['view sales', 'view service-orders']);

        $own = ServiceOrder::query()->create([
            'date' => now()->toDateString(),
            'vehicle' => 'Clio',
            'total_amount' => 500,
            'discount' => 0,
            'net_amount' => 500,
            'status' => 'TERMINÉE',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $commercial->id,
            'created_by' => $commercial->id,
        ]);

        $other = ServiceOrder::query()->create([
            'date' => now()->toDateString(),
            'vehicle' => 'Kangoo',
            'total_amount' => 700,
            'discount' => 0,
            'net_amount' => 700,
            'status' => 'TERMINÉE',
            'payment_status' => 'NON PAYE',
            'commercial_id' => $colleague->id,
            'created_by' => $colleague->id,
        ]);

        $response = $this->getJson('/api/work-queues');

        $ids = collect($response->json('to_invoice.rows'))->pluck('id')->all();
        $this->assertContains($own->id, $ids);
        $this->assertNotContains($other->id, $ids);
    }

    public function test_a_queue_the_user_cannot_view_is_absent(): void
    {
        $this->makeUser(['view sales']);   // pas de view service-orders

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $this->assertArrayHasKey('unpaid', $response->json());
        $this->assertArrayNotHasKey('to_invoice', $response->json());
    }

    // ── Montant par file : on arbitre entre les files sans les ouvrir ───────

    /**
     * Le montant suit la meme portee que les lignes. Un total d'agence affiche
     * a un commercial trahirait exactement ce que les lignes lui cachent.
     */
    public function test_the_queue_total_follows_the_same_scope_as_the_rows(): void
    {
        $colleague = User::query()->create([
            'name' => 'Collegue',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000009',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);

        $commercial = $this->makeUser(['view sales']);
        $this->makeUnpaidSale($commercial, $this->makeClient('Client D'), 1500);
        $this->makeUnpaidSale($commercial, $this->makeClient('Client E'), 2500);
        $this->makeUnpaidSale($colleague, $this->makeClient('Client F'), 9000);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk()->assertJsonPath('unpaid.count', 2);
        $this->assertEqualsWithDelta(4000, $response->json('unpaid.total'), 0.01);
    }

    // ── Produits sous seuil : la seule file sans proprietaire ───────────────

    private function makeProductWithStock(int $quantity, ?int $threshold = null): Product
    {
        $product = Product::query()->create([
            'reference' => 'REF-'.fake()->unique()->numerify('#####'),
            'type' => 'tyre',
            'alert_threshold' => $threshold,
            'is_active' => true,
        ]);

        Stock::query()->create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'purchase_price' => 500,
        ]);

        return $product;
    }

    public function test_the_low_stock_queue_is_shared_and_never_filtered_by_owner(): void
    {
        $this->makeUser(['view sales', 'view stock']);
        CompanySetting::query()->create(['company_name' => 'Test', 'default_alert_threshold' => 4]);

        $low = $this->makeProductWithStock(2);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk()->assertJsonPath('low_stock.scope', 'shared');
        $this->assertContains($low->id, collect($response->json('low_stock.rows'))->pluck('product_id')->all());
        // Une file de stock n'a pas de montant : c'est un compte d'articles.
        $this->assertNull($response->json('low_stock.total'));
    }

    public function test_an_article_above_its_threshold_stays_out_of_the_queue(): void
    {
        $this->makeUser(['view sales', 'view stock']);
        CompanySetting::query()->create(['company_name' => 'Test', 'default_alert_threshold' => 4]);

        $plenty = $this->makeProductWithStock(20);

        $response = $this->getJson('/api/work-queues');

        $this->assertNotContains($plenty->id, collect($response->json('low_stock.rows'))->pluck('product_id')->all());
    }

    /** Le seuil de l'article l'emporte sur le defaut d'agence. */
    public function test_the_article_threshold_overrides_the_agency_default(): void
    {
        $this->makeUser(['view sales', 'view stock']);
        CompanySetting::query()->create(['company_name' => 'Test', 'default_alert_threshold' => 2]);

        // 6 en stock : au-dessus du defaut d'agence, mais sous son propre seuil.
        $rare = $this->makeProductWithStock(6, 10);

        $response = $this->getJson('/api/work-queues');

        $this->assertContains($rare->id, collect($response->json('low_stock.rows'))->pluck('product_id')->all());
    }

    /** Sans aucun seuil configure, la file reste vide plutot que de tout remonter. */
    public function test_nothing_is_monitored_when_no_threshold_is_configured(): void
    {
        $this->makeUser(['view sales', 'view stock']);
        CompanySetting::query()->create(['company_name' => 'Test', 'default_alert_threshold' => null]);

        $this->makeProductWithStock(0);

        $response = $this->getJson('/api/work-queues');

        $this->assertSame(0, $response->json('low_stock.count'));
    }

    public function test_the_low_stock_queue_is_absent_without_the_stock_permission(): void
    {
        $this->makeUser(['view sales']);

        $response = $this->getJson('/api/work-queues');

        $response->assertOk();
        $this->assertArrayNotHasKey('low_stock', $response->json());
    }

    /** « Commander » doit ouvrir un achat pre-rempli : la ligne porte de quoi le faire. */
    public function test_a_low_stock_row_carries_what_the_purchase_draft_needs(): void
    {
        $this->makeUser(['view sales', 'view stock']);
        CompanySetting::query()->create(['company_name' => 'Test', 'default_alert_threshold' => 4]);

        $product = $this->makeProductWithStock(1);

        $response = $this->getJson('/api/work-queues');
        $row = collect($response->json('low_stock.rows'))->firstWhere('product_id', $product->id);

        $this->assertNotNull($row);
        $this->assertSame(1, $row['stock']);
        $this->assertSame(4, $row['threshold']);
        $this->assertNotNull($row['stock_id'], 'Une ligne d\'achat exige un lot.');
        $this->assertArrayHasKey('unit_price', $row);
        $this->assertArrayHasKey('supplier_id', $row);
    }
}
