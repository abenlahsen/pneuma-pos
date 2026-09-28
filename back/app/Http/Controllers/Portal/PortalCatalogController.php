<?php

namespace App\Http\Controllers\Portal;

use App\Domain\Portal\PortalAccount;
use App\Domain\Portal\PortalCatalog;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientPortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Catalogue, compte, relevé et documents du portail (étape 13.2).
 *
 * Le client vient toujours du compte du jeton (`currentClient()`), jamais
 * d'un paramètre : aucune de ces routes n'accepte de client_id, et un
 * document d'un autre client répond 404.
 */
class PortalCatalogController extends Controller
{
    public function __construct(
        private PortalCatalog $catalog,
        private PortalAccount $account,
    ) {}

    public function catalog(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => 'nullable|string|max:100',
            'brand_id' => 'nullable|integer',
            'season' => 'nullable|in:summer,winter,all_season',
            'load_index' => 'nullable|string|max:10',
            'available_only' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:'.PortalCatalog::MAX_PER_PAGE,
        ]);

        return response()->json($this->catalog->search($this->currentClient($request), $filters));
    }

    /**
     * Valeurs des filtres : seulement celles des produits visibles sur le portail.
     */
    public function filters(): JsonResponse
    {
        $visible = DB::table('products')
            ->where('products.type', 'tyre')
            ->where('products.is_active', true)
            ->whereNotNull('products.catalog_price');

        return response()->json([
            'brands' => (clone $visible)
                ->join('brands', 'brands.id', '=', 'products.brand_id')
                ->select('brands.id', 'brands.name')
                ->distinct()
                ->orderBy('brands.name')
                ->get(),
            'seasons' => (clone $visible)
                ->join('product_tyres', 'product_tyres.product_id', '=', 'products.id')
                ->whereNotNull('product_tyres.tire_season')
                ->distinct()
                ->orderBy('product_tyres.tire_season')
                ->pluck('product_tyres.tire_season'),
        ]);
    }

    public function account(Request $request): JsonResponse
    {
        return response()->json($this->account->summary($this->currentClient($request)));
    }

    public function statement(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->account->statement($this->currentClient($request))]);
    }

    public function documents(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->account->documents($this->currentClient($request))]);
    }

    public function document(Request $request, string $document): JsonResponse
    {
        $data = ctype_digit($document)
            ? $this->account->document($this->currentClient($request), (int) $document)
            : null;

        return $data
            ? response()->json($data)
            : response()->json(['message' => 'Document introuvable.'], 404);
    }

    /**
     * Le middleware portal.active a déjà vérifié le compte et son client.
     */
    private function currentClient(Request $request): Client
    {
        /** @var ClientPortalAccount $account */
        $account = $request->user('portal');

        return $account->client;
    }
}
