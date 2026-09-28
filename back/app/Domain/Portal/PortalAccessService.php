<?php

namespace App\Domain\Portal;

use App\Models\Client;
use App\Models\ClientPortalAccount;
use App\Models\User;
use App\Notifications\Portal\PortalInvitation;
use App\Notifications\Portal\PortalPasswordReset;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Les accès au portail client (étape 13.1) : invitation, activation,
 * réinitialisation, suspension.
 *
 * Les liens d'activation et de réinitialisation valent 72 h. Seul leur
 * hachage est stocké : un lien n'existe en clair que dans l'email envoyé,
 * ou dans la réponse de « Copier le lien d'activation ». En générer un
 * nouveau rend le précédent inutilisable.
 */
class PortalAccessService
{
    public const LINK_LIFETIME_HOURS = 72;

    // ── Côté agence ────────────────────────────────────────────────────────

    public function invite(Client $client, string $name, string $email, User $invitedBy): ClientPortalAccount
    {
        if (! $client->is_active) {
            throw ValidationException::withMessages([
                'client' => ['Ce client est archivé : réactivez-le avant de lui ouvrir un accès.'],
            ]);
        }

        $account = ClientPortalAccount::query()->create([
            'client_id' => $client->id,
            'name' => $name,
            'email' => Str::lower(trim($email)),
            'status' => ClientPortalAccount::STATUS_INVITED,
            'invited_at' => now(),
            'invited_by' => $invitedBy->id,
        ]);

        $this->sendInvitation($account);

        return $account->refresh();
    }

    /** Renvoie l'invitation avec un nouveau lien ; l'ancien ne sert plus. */
    public function resendInvitation(ClientPortalAccount $account): ClientPortalAccount
    {
        $this->assertInvitable($account);
        $account->forceFill(['invited_at' => now()])->save();
        $this->sendInvitation($account);

        return $account->refresh();
    }

    /**
     * Un nouveau lien d'activation, à copier pour l'envoyer par un autre canal.
     * Il remplace le précédent, envoyé par email ou copié.
     *
     * @return array{url: string, expires_at: Carbon}
     */
    public function activationLink(ClientPortalAccount $account): array
    {
        $this->assertInvitable($account);
        [$token, $expiresAt] = $this->issueActivationToken($account);

        return ['url' => $this->portalUrl('/portail/activation', $token), 'expires_at' => $expiresAt];
    }

    /** Suspend le compte et révoque tous ses jetons : il ne se connecte plus. */
    public function suspend(ClientPortalAccount $account): ClientPortalAccount
    {
        DB::transaction(function () use ($account) {
            $account->forceFill([
                'status' => ClientPortalAccount::STATUS_SUSPENDED,
                'suspended_at' => now(),
                'activation_token_hash' => null,
                'activation_expires_at' => null,
                'reset_token_hash' => null,
                'reset_expires_at' => null,
            ])->save();
            $account->tokens()->delete();
        });

        return $account->refresh();
    }

    /**
     * Réactive un compte suspendu : actif s'il avait déjà été activé, sinon
     * de nouveau invité (l'agence renvoie alors l'invitation).
     */
    public function reactivate(ClientPortalAccount $account): ClientPortalAccount
    {
        if (! $account->client || ! $account->client->is_active) {
            throw ValidationException::withMessages([
                'client' => ['Ce client est archivé : réactivez-le avant ses accès.'],
            ]);
        }

        $account->forceFill([
            'status' => $account->activated_at ? ClientPortalAccount::STATUS_ACTIVE : ClientPortalAccount::STATUS_INVITED,
            'suspended_at' => null,
        ])->save();

        return $account->refresh();
    }

    /** Un client archivé ou supprimé suspend tous ses comptes. */
    public function suspendAllFor(Client $client): void
    {
        ClientPortalAccount::query()
            ->where('client_id', $client->id)
            ->where('status', '!=', ClientPortalAccount::STATUS_SUSPENDED)
            ->get()
            ->each(fn (ClientPortalAccount $account) => $this->suspend($account));
    }

    // ── Côté client ────────────────────────────────────────────────────────

    /** Le client choisit son mot de passe ; le compte devient actif. */
    public function activate(string $token, string $password): ClientPortalAccount
    {
        $account = ClientPortalAccount::query()
            ->where('activation_token_hash', hash('sha256', $token))
            ->first();

        if (! $account
            || $account->status !== ClientPortalAccount::STATUS_INVITED
            || ! $account->activation_expires_at
            || $account->activation_expires_at->isPast()
            || ! $account->client
            || ! $account->client->is_active) {
            throw ValidationException::withMessages([
                'token' => ['Ce lien d\'activation n\'est plus valable. Demandez à l\'agence de vous le renvoyer.'],
            ]);
        }

        $account->forceFill([
            'password' => $password,
            'status' => ClientPortalAccount::STATUS_ACTIVE,
            'activated_at' => now(),
            'activation_token_hash' => null,
            'activation_expires_at' => null,
        ])->save();

        return $account->refresh();
    }

    /**
     * Demande de réinitialisation. Ne dit jamais si l'adresse existe : la
     * réponse est la même dans tous les cas.
     */
    public function requestPasswordReset(string $email): void
    {
        $account = ClientPortalAccount::query()->where('email', Str::lower(trim($email)))->first();
        if (! $account || ! $account->canUsePortal()) {
            return;
        }

        $token = Str::random(64);
        $expiresAt = now()->addHours(self::LINK_LIFETIME_HOURS);
        $account->forceFill([
            'reset_token_hash' => hash('sha256', $token),
            'reset_expires_at' => $expiresAt,
        ])->save();

        $account->notify(new PortalPasswordReset($this->portalUrl('/portail/reinitialisation', $token), $expiresAt));
    }

    /** Nouveau mot de passe ; toutes les sessions ouvertes sont fermées. */
    public function resetPassword(string $token, string $password): ClientPortalAccount
    {
        $account = ClientPortalAccount::query()
            ->where('reset_token_hash', hash('sha256', $token))
            ->first();

        if (! $account
            || ! $account->reset_expires_at
            || $account->reset_expires_at->isPast()
            || ! $account->canUsePortal()) {
            throw ValidationException::withMessages([
                'token' => ['Ce lien de réinitialisation n\'est plus valable. Faites une nouvelle demande.'],
            ]);
        }

        DB::transaction(function () use ($account, $password) {
            $account->forceFill([
                'password' => $password,
                'reset_token_hash' => null,
                'reset_expires_at' => null,
            ])->save();
            $account->tokens()->delete();
        });

        return $account->refresh();
    }

    // ── Aides ──────────────────────────────────────────────────────────────

    private function sendInvitation(ClientPortalAccount $account): void
    {
        [$token, $expiresAt] = $this->issueActivationToken($account);
        $account->notify(new PortalInvitation(
            $this->portalUrl('/portail/activation', $token),
            $expiresAt,
            (string) $account->client?->name,
        ));
    }

    /**
     * @return array{0: string, 1: Carbon}
     */
    private function issueActivationToken(ClientPortalAccount $account): array
    {
        $token = Str::random(64);
        $expiresAt = now()->addHours(self::LINK_LIFETIME_HOURS);
        $account->forceFill([
            'activation_token_hash' => hash('sha256', $token),
            'activation_expires_at' => $expiresAt,
        ])->save();

        return [$token, $expiresAt];
    }

    private function assertInvitable(ClientPortalAccount $account): void
    {
        if ($account->status !== ClientPortalAccount::STATUS_INVITED) {
            throw ValidationException::withMessages([
                'status' => [$account->status === ClientPortalAccount::STATUS_ACTIVE
                    ? 'Ce compte est déjà activé.'
                    : 'Ce compte est suspendu : réactivez-le d\'abord.'],
            ]);
        }
    }

    private function portalUrl(string $path, string $token): string
    {
        return rtrim((string) config('app.portal_url'), '/').$path.'?token='.urlencode($token);
    }
}
