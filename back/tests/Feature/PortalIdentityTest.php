<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\ClientPortalAccount;
use App\Models\User;
use App\Notifications\Portal\PortalInvitation;
use App\Notifications\Portal\PortalPasswordReset;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Étape 13.1 — l'identité client : un second public, séparé de l'équipe.
 *
 * Les requêtes portent de vrais jetons Bearer (pas Sanctum::actingAs), pour
 * éprouver les gardes elles-mêmes ; les gardes sont oubliées entre deux
 * requêtes d'un même test, comme entre deux requêtes HTTP réelles.
 */
class PortalIdentityTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    private string $adminToken;

    private Client $clientA;

    private Client $clientB;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Route::has('login')) {
            Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))->name('login');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['view clients', 'edit clients', 'delete clients', 'manage portal access'] as $perm) {
            Permission::findOrCreate($perm, 'web');
        }
        $role = Role::findOrCreate('Administrator', 'web');
        $role->syncPermissions(Permission::query()->get());

        $this->admin = $this->user('Admin Portail', ['Administrator']);
        $this->adminToken = $this->admin->createToken('auth-token')->plainTextToken;

        $this->clientA = Client::query()->create(['name' => 'Garage Atlas', 'category' => 'Garage', 'is_active' => true]);
        $this->clientB = Client::query()->create(['name' => 'Garage Borj', 'category' => 'Garage', 'is_active' => true]);

        Notification::fake();
        RateLimiter::clear('portal|atlas@garage.test|127.0.0.1');
    }

    // ── L'invitation et l'activation ───────────────────────────────────────

    public function test_the_agency_invites_a_contact_with_a_72_hour_activation_link(): void
    {
        $response = $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts", ['name' => 'Karim', 'email' => 'Atlas@Garage.test'])
            ->assertCreated()
            ->assertJsonPath('status', 'INVITE')
            ->assertJsonPath('email', 'atlas@garage.test')
            ->assertJsonPath('invited_by.name', 'Admin Portail');

        $this->assertArrayNotHasKey('activation_token_hash', $response->json());
        $this->assertArrayNotHasKey('password', $response->json());

        $account = ClientPortalAccount::find($response->json('id'));
        $this->assertEqualsWithDelta(72 * 3600, now()->diffInSeconds($account->activation_expires_at), 5);
        Notification::assertSentTo($account, PortalInvitation::class, fn ($n) => str_contains($n->url, '/portail/activation?token='));
    }

    public function test_an_email_can_only_have_one_access(): void
    {
        $this->invite($this->clientA, 'atlas@garage.test');
        $this->agency('POST', "/api/clients/{$this->clientB->id}/portal-accounts", ['name' => 'X', 'email' => 'atlas@garage.test'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_activation_sets_the_password_and_opens_a_session(): void
    {
        [, $token] = $this->invite($this->clientA, 'atlas@garage.test');

        $session = $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026'])
            ->assertOk()
            ->assertJsonPath('client.id', $this->clientA->id)
            ->json('token');

        $this->assertSame('ACTIF', ClientPortalAccount::where('email', 'atlas@garage.test')->value('status'));
        $this->portal('GET', '/api/portal/me', $session)->assertOk()->assertJsonPath('client.name', 'Garage Atlas');

        // Le lien ne sert qu'une fois.
        $this->forgetGuards();
        $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'Autre2026x', 'password_confirmation' => 'Autre2026x'])
            ->assertStatus(422)->assertJsonValidationErrors('token');
    }

    public function test_activation_reuses_the_team_password_rules(): void
    {
        [, $token] = $this->invite($this->clientA, 'atlas@garage.test');

        $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'court', 'password_confirmation' => 'court'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'Portail2026', 'password_confirmation' => 'Different1'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_an_activation_link_expires_after_72_hours(): void
    {
        [, $token] = $this->invite($this->clientA, 'atlas@garage.test');
        $this->travel(73)->hours();

        $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026'])
            ->assertStatus(422)->assertJsonValidationErrors('token');
    }

    public function test_copying_the_activation_link_issues_a_new_one_and_voids_the_emailed_one(): void
    {
        [$account, $emailed] = $this->invite($this->clientA, 'atlas@garage.test');

        $url = $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts/{$account->id}/activation-link")
            ->assertOk()->json('url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->forgetGuards();
        $this->postJson('/api/portal/activate', ['token' => $emailed, 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026'])
            ->assertStatus(422);
        $this->postJson('/api/portal/activate', ['token' => $query['token'], 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026'])
            ->assertOk();
    }

    public function test_resending_the_invitation_sends_a_new_link(): void
    {
        [$account] = $this->invite($this->clientA, 'atlas@garage.test');
        Notification::fake();

        $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts/{$account->id}/resend")->assertOk();
        Notification::assertSentTo($account, PortalInvitation::class);
    }

    // ── La connexion ───────────────────────────────────────────────────────

    public function test_login_with_the_right_password_only(): void
    {
        $this->activeAccount($this->clientA, 'atlas@garage.test');

        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Mauvais99'])->assertStatus(401);
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Portail2026'])
            ->assertOk()->assertJsonStructure(['token', 'account' => ['id', 'name', 'email'], 'client' => ['id', 'name']]);
        $this->assertNotNull(ClientPortalAccount::where('email', 'atlas@garage.test')->value('last_login_at'));
    }

    public function test_login_is_limited_to_5_attempts_per_15_minutes_per_email_and_ip(): void
    {
        $this->activeAccount($this->clientA, 'atlas@garage.test');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Mauvais99'])->assertStatus(401);
        }
        // La sixième, même avec le bon mot de passe, est refusée.
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Portail2026'])->assertStatus(429);

        $this->travel(16)->minutes();
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Portail2026'])->assertOk();
    }

    // ── La suspension ──────────────────────────────────────────────────────

    public function test_suspension_revokes_tokens_and_blocks_login_until_reactivation(): void
    {
        [$account, $session] = $this->activeAccount($this->clientA, 'atlas@garage.test');

        $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts/{$account->id}/suspend")
            ->assertOk()->assertJsonPath('status', 'SUSPENDU');
        $this->assertSame(0, $account->tokens()->count());

        $this->portal('GET', '/api/portal/me', $session)->assertStatus(401);
        $this->forgetGuards();
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Portail2026'])->assertStatus(403);

        $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts/{$account->id}/reactivate")
            ->assertOk()->assertJsonPath('status', 'ACTIF');
        $this->forgetGuards();
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Portail2026'])->assertOk();
    }

    public function test_archiving_the_client_suspends_all_its_accounts(): void
    {
        [$first, $session] = $this->activeAccount($this->clientA, 'atlas@garage.test');
        [$second] = $this->invite($this->clientA, 'compta@garage.test');
        [$other] = $this->activeAccount($this->clientB, 'borj@garage.test');

        $this->clientA->update(['is_active' => false]);

        $this->assertSame('SUSPENDU', $first->fresh()->status);
        $this->assertSame('SUSPENDU', $second->fresh()->status);
        $this->assertSame('ACTIF', $other->fresh()->status);
        $this->portal('GET', '/api/portal/me', $session)->assertStatus(401);
    }

    public function test_deleting_the_client_suspends_its_accounts_and_keeps_their_trace(): void
    {
        [$account] = $this->activeAccount($this->clientA, 'atlas@garage.test');

        $this->clientA->delete();

        $account = $account->fresh();
        $this->assertSame('SUSPENDU', $account->status);
        $this->assertNull($account->client_id);
        $this->assertSame(0, $account->tokens()->count());
    }

    public function test_a_session_of_a_suspended_account_is_refused_even_if_its_token_survived(): void
    {
        [$account, $session] = $this->activeAccount($this->clientA, 'atlas@garage.test');
        // Suspendu hors du service (sans révocation) : le middleware le refuse quand même.
        $account->forceFill(['status' => 'SUSPENDU'])->save();

        $this->portal('GET', '/api/portal/me', $session)->assertStatus(403);
    }

    // ── Le mot de passe oublié ─────────────────────────────────────────────

    public function test_password_reset_answers_the_same_whatever_the_email_and_closes_sessions(): void
    {
        [$account, $session] = $this->activeAccount($this->clientA, 'atlas@garage.test');

        $unknown = $this->postJson('/api/portal/password/forgot', ['email' => 'inconnu@garage.test'])->assertOk()->json('message');
        $known = $this->postJson('/api/portal/password/forgot', ['email' => 'atlas@garage.test'])->assertOk()->json('message');
        $this->assertSame($unknown, $known);

        $token = null;
        Notification::assertSentTo($account, PortalPasswordReset::class, function ($n) use (&$token) {
            parse_str(parse_url($n->url, PHP_URL_QUERY), $query);
            $token = $query['token'];

            return str_contains($n->url, '/portail/reinitialisation?token=');
        });

        $this->postJson('/api/portal/password/reset', ['token' => $token, 'password' => 'Nouveau2026', 'password_confirmation' => 'Nouveau2026'])->assertOk();
        $this->assertSame(0, $account->tokens()->count());
        $this->portal('GET', '/api/portal/me', $session)->assertStatus(401);
        $this->forgetGuards();
        $this->postJson('/api/portal/login', ['email' => 'atlas@garage.test', 'password' => 'Nouveau2026'])->assertOk();
    }

    // ── Deux publics, deux gardes ──────────────────────────────────────────

    public function test_a_portal_token_never_opens_an_agency_route(): void
    {
        [, $session] = $this->activeAccount($this->clientA, 'atlas@garage.test');

        foreach (['/api/user', '/api/clients', "/api/clients/{$this->clientA->id}", "/api/clients/{$this->clientA->id}/portal-accounts", '/api/sales', '/api/business-date'] as $agencyRoute) {
            $this->portal('GET', $agencyRoute, $session)->assertStatus(401);
        }
    }

    public function test_an_agency_token_never_opens_a_portal_route(): void
    {
        $this->withToken($this->adminToken)->getJson('/api/portal/me')->assertStatus(401);
        $this->forgetGuards();
        $this->withToken($this->adminToken)->postJson('/api/portal/logout')->assertStatus(401);
    }

    // ── Les droits de l'agence ─────────────────────────────────────────────

    public function test_managing_portal_access_needs_its_permission(): void
    {
        $commercial = $this->user('Commercial Sans Droit', []);
        $commercial->givePermissionTo(['view clients']);
        $token = $commercial->createToken('auth-token')->plainTextToken;

        $this->withToken($token)->getJson("/api/clients/{$this->clientA->id}/portal-accounts")->assertForbidden();
        $this->forgetGuards();
        $this->withToken($token)->postJson("/api/clients/{$this->clientA->id}/portal-accounts", ['name' => 'X', 'email' => 'x@garage.test'])->assertForbidden();
    }

    public function test_an_account_of_another_client_is_not_found_under_this_client(): void
    {
        [$accountOfB] = $this->invite($this->clientB, 'borj@garage.test');

        foreach (['resend', 'activation-link', 'suspend', 'reactivate'] as $action) {
            $this->agency('POST', "/api/clients/{$this->clientA->id}/portal-accounts/{$accountOfB->id}/{$action}")->assertNotFound();
        }
        $ids = collect($this->agency('GET', "/api/clients/{$this->clientA->id}/portal-accounts")->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($accountOfB->id));
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    /** @return array{0: ClientPortalAccount, 1: string} le compte et le jeton d'activation envoyé */
    private function invite(Client $client, string $email): array
    {
        Notification::fake();
        $id = $this->agency('POST', "/api/clients/{$client->id}/portal-accounts", ['name' => 'Contact', 'email' => $email])
            ->assertCreated()->json('id');
        $account = ClientPortalAccount::find($id);

        $token = null;
        Notification::assertSentTo($account, PortalInvitation::class, function ($n) use (&$token) {
            parse_str(parse_url($n->url, PHP_URL_QUERY), $query);
            $token = $query['token'];

            return true;
        });
        $this->forgetGuards();

        return [$account, $token];
    }

    /** @return array{0: ClientPortalAccount, 1: string} le compte actif et un jeton de session */
    private function activeAccount(Client $client, string $email): array
    {
        [$account, $token] = $this->invite($client, $email);
        $session = $this->postJson('/api/portal/activate', ['token' => $token, 'password' => 'Portail2026', 'password_confirmation' => 'Portail2026'])
            ->assertOk()->json('token');
        $this->forgetGuards();

        return [$account->fresh(), $session];
    }

    private function agency(string $method, string $uri, array $data = [])
    {
        $this->forgetGuards();

        return $this->withToken($this->adminToken)->json($method, $uri, $data);
    }

    private function portal(string $method, string $uri, string $token, array $data = [])
    {
        $this->forgetGuards();

        return $this->withToken($token)->json($method, $uri, $data);
    }

    private function forgetGuards(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
    }

    /** @param  array<int, string>  $roles */
    private function user(string $name, array $roles): User
    {
        $user = User::query()->create([
            'name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password',
            'phone' => '0600000000',
            'commission_rate' => 0,
            'must_change_password' => false,
        ]);
        foreach ($roles as $role) {
            $user->assignRole($role);
        }

        return $user;
    }
}
