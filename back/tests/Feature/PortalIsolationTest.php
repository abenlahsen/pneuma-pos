<?php

namespace Tests\Feature;

use App\Domain\Portal\PortalAccessService;
use App\Models\Client;
use App\Models\ClientPortalAccount;
use App\Models\Product;
use App\Models\Sale;
use App\Notifications\Portal\PortalInvitation;
use App\Notifications\Portal\PortalPasswordReset;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\PortalFixtures;
use Tests\TestCase;

/**
 * Étape 13.2 — le cloisonnement : le client A ne voit jamais rien du client B.
 *
 * Chaque route /api/portal/* est inscrite dans COVERAGE avec son test
 * « autre client » ; le premier test échoue dès qu'une route portail est
 * ajoutée sans le sien. Le client vient toujours du jeton : un client_id
 * glissé dans la requête est ignoré, un document de B répond 404.
 */
class PortalIsolationTest extends TestCase
{
    use DatabaseTransactions;
    use PortalFixtures;

    /** Chaque route portail → son test « autre client ». */
    private const COVERAGE = [
        'POST api/portal/login' => 'test_login_opens_only_the_session_of_its_own_client',
        'POST api/portal/activate' => 'test_an_activation_link_of_client_b_never_activates_an_account_of_a',
        'POST api/portal/password/forgot' => 'test_password_forgot_answers_the_same_for_a_contact_of_b',
        'POST api/portal/password/reset' => 'test_a_reset_link_of_b_never_changes_the_password_of_a',
        'GET api/portal/me' => 'test_me_describes_the_client_of_the_token_whatever_the_client_id_sent',
        'POST api/portal/logout' => 'test_logout_of_a_leaves_the_sessions_of_b_open',
        'GET api/portal/catalog' => 'test_the_catalog_of_a_carries_a_prices_never_b_prices',
        'GET api/portal/catalog/filters' => 'test_catalog_filters_carry_no_client_data',
        'GET api/portal/account' => 'test_the_account_of_a_ignores_a_client_id_of_b',
        'GET api/portal/statement' => 'test_the_statement_of_a_has_no_entry_of_b',
        'GET api/portal/documents' => 'test_the_documents_of_a_do_not_list_those_of_b',
        'GET api/portal/documents/{document}' => 'test_a_document_of_b_is_not_found_for_a',
    ];

    /** Jamais dans une réponse portail. */
    private const FORBIDDEN_KEYS = [
        'purchase_price', 'total_purchase', 'margin', 'cost',
        'user_id', 'commercial', 'commercial_id', 'created_by', 'creator',
        'partner', 'partner_id', 'notes', 'comments',
        'depot', 'zone', 'dot', 'lot', 'stock_id', 'stocks',
        'supplier', 'supplier_id', 'expected_quantity',
        'password', 'activation_token_hash', 'reset_token_hash',
    ];

    private Client $clientA;

    private Client $clientB;

    private ClientPortalAccount $accountA;

    private ClientPortalAccount $accountB;

    private string $tokenA;

    private string $tokenB;

    private Product $tyre;

    private Sale $saleA;

    private Sale $saleB;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->makeStaff();
        $this->clientA = $this->portalClient('Garage Atlas', ['discount_rate' => 0]);
        $this->clientB = $this->portalClient('Garage Borj', ['discount_rate' => 20, 'credit_limit' => 50000, 'opening_balance' => 777]);
        [$this->accountA, $this->tokenA] = $this->portalSession($this->clientA, 'atlas@garage.test');
        [$this->accountB, $this->tokenB] = $this->portalSession($this->clientB, 'borj@garage.test');

        $this->tyre = $this->catalogTyre('Cloison Primacy', 1000);
        $this->lot($this->tyre, 3);

        $this->saleA = $this->sale($this->clientA, $this->tyre, 1800, '2026-09-01');
        $this->saleB = $this->sale($this->clientB, $this->tyre, 9400, '2026-09-02');
        $this->pay($this->saleB, 400, '2026-09-03');
    }

    // ── Le registre ────────────────────────────────────────────────────────

    public function test_every_portal_route_has_its_other_client_test(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn (RoutingRoute $r) => str_starts_with($r->uri(), 'api/portal'))
            ->flatMap(fn (RoutingRoute $r) => collect($r->methods())->reject(fn ($m) => $m === 'HEAD')->map(fn ($m) => $m.' '.$r->uri()))
            ->sort()->values()->all();

        $covered = collect(self::COVERAGE)->keys()->sort()->values()->all();

        $this->assertSame($routes, $covered, 'Chaque route portail doit avoir son test « autre client » dans COVERAGE.');
        foreach (self::COVERAGE as $route => $test) {
            $this->assertTrue(method_exists($this, $test), "{$route} : le test {$test} n'existe pas.");
        }
        fwrite(STDERR, sprintf("\n  Routes portail : %d · couvertes par un test « autre client » : %d\n", count($routes), count(array_intersect($routes, $covered))));
    }

    // ── Identité ───────────────────────────────────────────────────────────

    public function test_login_opens_only_the_session_of_its_own_client(): void
    {
        $this->portal('POST', '/api/portal/login', null, ['email' => 'atlas@garage.test', 'password' => 'Portail2026', 'client_id' => $this->clientB->id])
            ->assertOk()
            ->assertJsonPath('client.id', $this->clientA->id);

        // L'email de B avec le mot de passe de A n'ouvre rien.
        $this->accountB->forceFill(['password' => 'AutreSecret99'])->save();
        $this->portal('POST', '/api/portal/login', null, ['email' => 'borj@garage.test', 'password' => 'Portail2026'])
            ->assertUnauthorized();
    }

    public function test_an_activation_link_of_client_b_never_activates_an_account_of_a(): void
    {
        $access = app(PortalAccessService::class);
        $pendingA = $access->invite($this->clientA, 'Second A', 'second@atlas.test', $this->staff);
        $pendingB = $access->invite($this->clientB, 'Second B', 'second@borj.test', $this->staff);
        $tokenOfB = $this->notifiedToken($pendingB, PortalInvitation::class);

        $this->portal('POST', '/api/portal/activate', null, ['token' => $tokenOfB, 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026', 'client_id' => $this->clientA->id])
            ->assertOk()
            ->assertJsonPath('client.id', $this->clientB->id);

        $this->assertSame(ClientPortalAccount::STATUS_INVITED, $pendingA->fresh()->status);
    }

    public function test_password_forgot_answers_the_same_for_a_contact_of_b(): void
    {
        $forB = $this->portal('POST', '/api/portal/password/forgot', $this->tokenA, ['email' => 'borj@garage.test'])->assertOk()->json();
        $forUnknown = $this->portal('POST', '/api/portal/password/forgot', $this->tokenA, ['email' => 'personne@nulle.part'])->assertOk()->json();

        $this->assertSame($forUnknown, $forB, 'La réponse ne doit pas dire si B a un accès.');
        Notification::assertNotSentTo($this->accountA, PortalPasswordReset::class);
    }

    public function test_a_reset_link_of_b_never_changes_the_password_of_a(): void
    {
        app(PortalAccessService::class)->requestPasswordReset('borj@garage.test');
        $tokenOfB = $this->notifiedToken($this->accountB, PortalPasswordReset::class);

        $this->portal('POST', '/api/portal/password/reset', $this->tokenA, ['token' => $tokenOfB, 'email' => 'atlas@garage.test', 'password' => 'Nouveau2026', 'password_confirmation' => 'Nouveau2026'])
            ->assertOk();

        $this->assertTrue(Hash::check('Portail2026', $this->accountA->fresh()->password));
        $this->assertTrue(Hash::check('Nouveau2026', $this->accountB->fresh()->password));
    }

    public function test_me_describes_the_client_of_the_token_whatever_the_client_id_sent(): void
    {
        $this->portal('GET', '/api/portal/me?client_id='.$this->clientB->id, $this->tokenA)
            ->assertOk()
            ->assertJsonPath('client.id', $this->clientA->id)
            ->assertJsonPath('account.id', $this->accountA->id);
    }

    public function test_logout_of_a_leaves_the_sessions_of_b_open(): void
    {
        $this->portal('POST', '/api/portal/logout', $this->tokenA, ['client_id' => $this->clientB->id])->assertOk();

        $this->portal('GET', '/api/portal/me', $this->tokenA)->assertUnauthorized();
        $this->portal('GET', '/api/portal/me', $this->tokenB)->assertOk()->assertJsonPath('client.id', $this->clientB->id);
    }

    // ── Catalogue ──────────────────────────────────────────────────────────

    public function test_the_catalog_of_a_carries_a_prices_never_b_prices(): void
    {
        $rowA = $this->portal('GET', '/api/portal/catalog?q=Cloison&client_id='.$this->clientB->id, $this->tokenA)
            ->assertOk()->json('data.0');
        $rowB = $this->portal('GET', '/api/portal/catalog?q=Cloison', $this->tokenB)
            ->assertOk()->json('data.0');

        $this->assertSame($this->tyre->id, $rowA['id']);
        $this->assertEquals(1000, $rowA['price'], 'A n\'a pas de remise : le prix catalogue.');
        $this->assertEquals(0, $rowA['discount_rate']);
        $this->assertEquals(800, $rowB['price'], 'B a 20 % de remise.');
    }

    public function test_catalog_filters_carry_no_client_data(): void
    {
        $forA = $this->portal('GET', '/api/portal/catalog/filters?client_id='.$this->clientB->id, $this->tokenA)->assertOk()->json();
        $forB = $this->portal('GET', '/api/portal/catalog/filters', $this->tokenB)->assertOk()->json();

        $this->assertSame($forB, $forA);
        $this->assertSame(['brands', 'seasons'], array_keys($forA));
    }

    // ── Compte, relevé, documents ──────────────────────────────────────────

    public function test_the_account_of_a_ignores_a_client_id_of_b(): void
    {
        $this->portal('GET', '/api/portal/account?client_id='.$this->clientB->id, $this->tokenA)
            ->assertOk()
            ->assertJsonPath('balance_due', 1800)
            ->assertJsonPath('credit_limit', null);

        $this->portal('GET', '/api/portal/account', $this->tokenB)
            ->assertOk()
            ->assertJsonPath('balance_due', 777 + 9400 - 400)
            ->assertJsonPath('credit_limit', 50000);
    }

    public function test_the_statement_of_a_has_no_entry_of_b(): void
    {
        $entries = collect($this->portal('GET', '/api/portal/statement?client_id='.$this->clientB->id, $this->tokenA)->assertOk()->json('data'));

        $this->assertSame([$this->saleA->id], $entries->pluck('document_id')->filter()->unique()->values()->all());
        $this->assertFalse($entries->contains('type', 'opening_balance'), 'Le solde d\'ouverture de B ne remonte pas chez A.');
        $this->assertEquals(1800, $entries->first()['balance']);
    }

    public function test_the_documents_of_a_do_not_list_those_of_b(): void
    {
        $ids = collect($this->portal('GET', '/api/portal/documents?client_id='.$this->clientB->id, $this->tokenA)->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($this->saleA->id));
        $this->assertFalse($ids->contains($this->saleB->id));
    }

    public function test_a_document_of_b_is_not_found_for_a(): void
    {
        $this->portal('GET', "/api/portal/documents/{$this->saleB->id}", $this->tokenA)->assertNotFound();
        $this->portal('GET', "/api/portal/documents/{$this->saleB->id}?client_id={$this->clientB->id}", $this->tokenA)->assertNotFound();
        $this->portal('GET', '/api/portal/documents/'.($this->saleB->id + 100000), $this->tokenA)->assertNotFound();
        $this->portal('GET', '/api/portal/documents/abc', $this->tokenA)->assertNotFound();

        // Son propre document s'ouvre ; annulé, il n'existe plus pour lui.
        $this->portal('GET', "/api/portal/documents/{$this->saleA->id}", $this->tokenA)->assertOk()->assertJsonPath('id', $this->saleA->id);
        $this->saleA->forceFill(['status' => 'ANNULE'])->save();
        $this->portal('GET', "/api/portal/documents/{$this->saleA->id}", $this->tokenA)->assertNotFound();
    }

    // ── Les clés interdites ────────────────────────────────────────────────

    public function test_no_portal_response_carries_an_internal_key(): void
    {
        $responses = [
            'login' => $this->portal('POST', '/api/portal/login', null, ['email' => 'atlas@garage.test', 'password' => 'Portail2026']),
            'me' => $this->portal('GET', '/api/portal/me', $this->tokenA),
            'catalog' => $this->portal('GET', '/api/portal/catalog?q=Cloison', $this->tokenA),
            'catalog/filters' => $this->portal('GET', '/api/portal/catalog/filters', $this->tokenA),
            'account' => $this->portal('GET', '/api/portal/account', $this->tokenA),
            'statement' => $this->portal('GET', '/api/portal/statement', $this->tokenA),
            'documents' => $this->portal('GET', '/api/portal/documents', $this->tokenA),
            'documents/{id}' => $this->portal('GET', "/api/portal/documents/{$this->saleA->id}", $this->tokenA),
        ];

        foreach ($responses as $name => $response) {
            $response->assertOk();
            $keys = $this->keysOf($response->json());
            foreach (self::FORBIDDEN_KEYS as $forbidden) {
                $this->assertNotContains($forbidden, $keys, "{$name} renvoie la clé interdite « {$forbidden} ».");
            }
        }

        // Pas de quantité de stock au catalogue ; la quantité vendue d'une
        // ligne de document, elle, est celle du client.
        $this->assertNotContains('quantity', $this->keysOf($responses['catalog']->json()));
        $this->assertStringNotContainsString('Note interne', $responses['documents/{id}']->getContent());
        $this->assertStringNotContainsString('Note interne', $responses['statement']->getContent());
        $this->assertStringNotContainsString($this->staff->name, $responses['documents/{id}']->getContent());
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    /** @return array<int, string> toutes les clés, à toute profondeur */
    private function keysOf(mixed $data): array
    {
        if (! is_array($data)) {
            return [];
        }
        $keys = [];
        foreach ($data as $key => $value) {
            if (is_string($key)) {
                $keys[] = $key;
            }
            array_push($keys, ...$this->keysOf($value));
        }

        return array_values(array_unique($keys));
    }

    private function notifiedToken(ClientPortalAccount $account, string $notification): string
    {
        $token = null;
        Notification::assertSentTo($account, $notification, function ($n) use (&$token) {
            parse_str(parse_url($n->url, PHP_URL_QUERY), $query);
            $token = $query['token'];

            return true;
        });

        return $token;
    }
}
