<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Sale;
use App\Models\ServiceOrder;
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
            'view sales', 'view service-orders',
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
}
