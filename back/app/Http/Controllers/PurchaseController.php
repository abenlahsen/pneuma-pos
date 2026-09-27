<?php

namespace App\Http\Controllers;

use App\Domain\Purchases\PurchaseCatalogService;
use App\Domain\Purchases\PurchaseService;
use App\Enums\PurchasePaymentStatus;
use App\Enums\PurchaseStatus;
use App\Models\Purchase;
use App\Support\Helpers\ProductLabel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchaseService) {}

    public function index(Request $request): JsonResponse
    {
        $paginated = $this->purchaseService->list($request->all());

        if ($request->boolean('all')) {
            return response()->json($paginated);
        }

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => $paginated->items(),
            'first_page_url' => $paginated->url(1),
            'from' => $paginated->firstItem(),
            'last_page' => $paginated->lastPage(),
            'last_page_url' => $paginated->url($paginated->lastPage()),
            'links' => $paginated->linkCollection()->toArray(),
            'next_page_url' => $paginated->nextPageUrl(),
            'path' => $paginated->path(),
            'per_page' => $paginated->perPage(),
            'prev_page_url' => $paginated->previousPageUrl(),
            'to' => $paginated->lastItem(),
            'total' => $paginated->total(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'bl_number' => 'nullable|string|max:100',
            'invoice_number' => 'nullable|string|max:100',
            'discount' => 'nullable|numeric|min:0|max:100',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => ['required', Rule::in(PurchaseStatus::values())],
            'payment_status' => ['required', Rule::in(PurchasePaymentStatus::values())],
            // Un achat créé « Reçu » peut porter sa date de réception ; sans
            // elle, c'est le jour de l'enregistrement.
            'received_at' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->purchaseService->rejectServicePurchases($validated['items'])) {
            return response()->json($error, 422);
        }

        $purchase = $this->purchaseService->create($validated, $request->user()->id);

        return response()->json($purchase, 201);
    }

    /**
     * Réceptionner un achat attendu : le stock entre, le statut passe à
     * « Reçu », la date de réception est enregistrée. Refusé (422) si l'achat
     * est déjà reçu, terminé ou annulé.
     */
    public function receive(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'received_at' => 'nullable|date|before_or_equal:today',
        ]);

        $received = $this->purchaseService->receive($purchase, $validated['received_at'] ?? null, $request->user()->id);

        return response()->json($received);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        $purchase = $this->purchaseService->loadRelations($purchase);

        // Refonte 2b, 10a : le bon d'achat imprime « total dû au fournisseur »,
        // « déjà payé » et « reste dû ». Ce sont les deux chiffres contre
        // lesquels refreshPaymentStatus() compare — retours déduits, et
        // remboursements du fournisseur retranchés de ce qui a été payé — et
        // non net_amount brut ni la simple somme des paiements.
        $purchase->setAttribute('effective_net_amount', $purchase->effectiveNetAmount());
        $purchase->setAttribute('paid_amount', $purchase->netPaidAmount());

        return response()->json($purchase);
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $isAdmin = $request->user()->hasRole('Administrator');

        if ($purchase->status === PurchaseStatus::TERMINE->value && ! $isAdmin) {
            return response()->json(['message' => 'Cet achat est terminé et ne peut plus être modifié.'], 403);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'bl_number' => 'nullable|string|max:100',
            'invoice_number' => 'nullable|string|max:100',
            'discount' => 'nullable|numeric|min:0|max:100',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => ['required', Rule::in(PurchaseStatus::values())],
            'payment_status' => ['required', Rule::in(PurchasePaymentStatus::values())],
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->purchaseService->rejectServicePurchases($validated['items'])) {
            return response()->json($error, 422);
        }

        $purchase = $this->purchaseService->update($purchase, $validated, $request->user()->id, $isAdmin);

        return response()->json($purchase);
    }

    public function updateStatus(Request $request, Purchase $purchase): JsonResponse
    {
        $isAdmin = $request->user()->hasRole('Administrator');

        if ($purchase->status === PurchaseStatus::TERMINE->value && ! $isAdmin) {
            return response()->json(['message' => 'Cet achat est terminé et ne peut plus être modifié.'], 403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(PurchaseStatus::values())],
        ]);

        $this->purchaseService->patchStatus($purchase, $validated['status'], $request->user()->id, $isAdmin);

        return response()->json(['status' => $validated['status']]);
    }

    public function destroy(Request $request, Purchase $purchase): JsonResponse
    {
        if ($purchase->status === PurchaseStatus::TERMINE->value && ! $request->user()->hasRole('Administrator')) {
            return response()->json(['message' => 'Cet achat est terminé et ne peut plus être supprimé.'], 403);
        }

        $this->purchaseService->delete($purchase, $request->user()?->id);

        return response()->json(null, 204);
    }

    /** Refonte 2b : les achats groupés par fournisseur, retours imbriqués. */
    public function grouped(Request $request): JsonResponse
    {
        return response()->json($this->purchaseService->groupedBySupplier($request->all()));
    }

    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->purchaseService->summary($request->all()));
    }

    public function filters(): JsonResponse
    {
        return response()->json($this->purchaseService->filters());
    }

    /**
     * Refonte 2b, 12b : la recherche de la saisie d'achat — produits, lots,
     * dernier prix d'achat (général et chez le fournisseur), dernier prix de
     * vente. Voir PurchaseCatalogService.
     */
    public function catalog(Request $request, PurchaseCatalogService $catalog): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:100',
            'supplier_id' => 'nullable|integer',
            'ids' => 'nullable|array|max:100',
            'ids.*' => 'integer',
            'exclude_purchase_id' => 'nullable|integer',
        ]);

        return response()->json(['data' => $catalog->search($validated)]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $request->except(['page', 'per_page']);
        $purchases = $this->purchaseService->buildFilteredQuery($filters)->get();

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $rows = [['Date', 'Fournisseur', 'Commercial', 'Statut', 'Paiement', 'Mode(s) paiement', 'Facture', 'N° BL', 'N° Facture', 'Remise (%)', 'Qté totale', 'Produits', 'Total HT', 'Net', 'Qté retournée', 'Montant retourné']];

        foreach ($purchases as $purchase) {
            $rows[] = [
                $purchase->date?->toDateString() ?? '',
                $purchase->supplier?->name ?? '',
                $purchase->commercial?->name ?? '',
                $purchase->status ?? '',
                $purchase->payment_status ?? '',
                implode(', ', $purchase->payment_methods),
                $purchase->with_invoice ? 'Oui' : 'Non',
                $purchase->bl_number ?? '',
                $purchase->invoice_number ?? '',
                (float) ($purchase->discount ?? 0),
                (int) ($purchase->total_quantity ?? 0),
                $this->formatItemsColumn($purchase->items),
                (float) ($purchase->total_price ?? 0),
                (float) ($purchase->net_amount ?? 0),
                (int) ($purchase->returned_quantity ?? 0),
                (float) ($purchase->returned_amount ?? 0),
            ];
        }

        $sheet->fromArray($rows, null, 'A1', true);

        $filename = 'achats_'.now()->format('Ymd_His').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * Concatenate a purchase's line items into a single "Désignation (x qté), ..." string for exports,
     * mirroring the product label shown on the printed bon d'achat (label — reference · details).
     */
    private function formatItemsColumn($items): string
    {
        return $items->map(function ($item) {
            $label = ProductLabel::format($item->linkedProduct, 'Produit #'.$item->product_id);

            return $label.' (x'.(int) $item->quantity.')';
        })->implode(', ');
    }
}
