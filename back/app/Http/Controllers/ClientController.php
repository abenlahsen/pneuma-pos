<?php

namespace App\Http\Controllers;

use App\Domain\Clients\ClientService;
use App\Http\Requests\StoreClientRequest;
use App\Http\Requests\UpdateClientRequest;
use App\Http\Resources\Clients\ClientProfileResource;
use App\Http\Resources\Clients\ClientResource;
use App\Http\Resources\Clients\ClientStatementResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientController extends Controller
{
    public function __construct(
        protected ClientService $clientService
    ) {
    }

    public function index(Request $request)
    {
        return ClientResource::collection(
            $this->clientService->paginate($request->all())
        );
    }

    public function store(StoreClientRequest $request): ClientResource
    {
        $client = $this->clientService->create($request->validated());

        return new ClientResource($client);
    }

    public function show(Client $client): ClientResource
    {
        return new ClientResource($client);
    }

    public function update(UpdateClientRequest $request, Client $client): ClientResource
    {
        $client = $this->clientService->update($client, $request->validated());

        return new ClientResource($client);
    }

    public function destroy(Client $client): JsonResponse
    {
        $this->clientService->delete($client);

        return response()->json([], 204);
    }

    public function profile(Client $client): ClientProfileResource
    {
        return new ClientProfileResource(
            $this->clientService->getProfile($client)
        );
    }

    public function statement(Client $client): ClientStatementResource
    {
        return new ClientStatementResource(
            $this->clientService->getStatement($client)
        );
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $request->except(['page', 'per_page']);
        $clients = $this->clientService->buildFilteredQuery($filters)->get();

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $rows = [[
            'Nom', 'Type', 'Téléphone', 'Email', 'Ville', 'Adresse', 'Statut',
            'Limite de crédit', 'Solde d\'ouverture', 'Délai de paiement (jours)',
            'Mode de paiement par défaut', 'Créé le',
        ]];

        foreach ($clients as $client) {
            $rows[] = [
                $client->name,
                $client->category ?? '',
                $client->phone ?? '',
                $client->email ?? '',
                $client->city ?? '',
                $client->address ?? '',
                $client->is_active ? 'Actif' : 'Inactif',
                (float) ($client->credit_limit ?? 0),
                (float) ($client->opening_balance ?? 0),
                (int) ($client->payment_terms_days ?? 0),
                $client->default_payment_method ?? '',
                $client->created_at?->toDateString() ?? '',
            ];
        }

        $sheet->fromArray($rows, null, 'A1', true);
        $sheet->getStyle('A1:L1')->getFont()->setBold(true);

        $filename = 'clients_'.now()->format('Ymd_His').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    public function duplicates(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'except_id' => ['nullable', 'integer', 'exists:clients,id'],
        ]);

        $matches = $this->clientService->findDuplicates(
            $validated['name'] ?? null,
            $validated['phone'] ?? null,
            $validated['except_id'] ?? null
        );

        return response()->json([
            'matches' => ClientResource::collection($matches)->resolve(),
        ]);
    }
}