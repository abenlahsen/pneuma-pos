<?php

namespace App\Http\Controllers;

use App\Domain\Portal\PortalAccessService;
use App\Http\Resources\Portal\PortalAccountResource;
use App\Models\Client;
use App\Models\ClientPortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Les accès portail d'un client, côté agence (étape 13.1, permission
 * `manage portal access`). Les routes sont imbriquées sous le client et
 * `scopeBindings` : un compte d'un autre client répond 404.
 */
class ClientPortalAccessController extends Controller
{
    public function __construct(private PortalAccessService $access) {}

    public function index(Client $client): JsonResponse
    {
        $accounts = ClientPortalAccount::query()
            ->with('inviter:id,name')
            ->where('client_id', $client->id)
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => PortalAccountResource::collection($accounts)->resolve()]);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('client_portal_accounts', 'email')],
        ]);

        $account = $this->access->invite($client, $validated['name'], $validated['email'], $request->user());

        return response()->json((new PortalAccountResource($account->load('inviter:id,name')))->resolve(), 201);
    }

    public function resend(Client $client, ClientPortalAccount $portalAccount): JsonResponse
    {
        $account = $this->access->resendInvitation($portalAccount);

        return response()->json((new PortalAccountResource($account->load('inviter:id,name')))->resolve());
    }

    /** « Copier le lien d'activation » : un lien neuf, à envoyer par un autre canal. */
    public function activationLink(Client $client, ClientPortalAccount $portalAccount): JsonResponse
    {
        $link = $this->access->activationLink($portalAccount);

        return response()->json(['url' => $link['url'], 'expires_at' => $link['expires_at']->toIso8601String()]);
    }

    public function suspend(Client $client, ClientPortalAccount $portalAccount): JsonResponse
    {
        $account = $this->access->suspend($portalAccount);

        return response()->json((new PortalAccountResource($account->load('inviter:id,name')))->resolve());
    }

    public function reactivate(Client $client, ClientPortalAccount $portalAccount): JsonResponse
    {
        $account = $this->access->reactivate($portalAccount);

        return response()->json((new PortalAccountResource($account->load('inviter:id,name')))->resolve());
    }
}
