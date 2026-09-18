<?php

namespace App\Domain\Stock;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Services\StockMovementService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StockService
{
    /**
     * @var StockMovementService
     */
    private $movements;

    /**
     * @param StockMovementService $movements
     */
    public function __construct(StockMovementService $movements)
    {
        $this->movements = $movements;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator|Collection
     */
    public function list(array $filters = [])
    {
        $query = $this->buildStockQuery($filters);

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 50));
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    /**
     * @param  array<string, mixed>  $validated
     * @param  int|null  $userId
     * @return Stock
     */
    public function create(array $validated, $userId)
    {
        $product = Product::find($validated['product_id']);

        if ($product && $product->type === 'service') {
            abort(response()->json([
                'message' => 'Les services ne peuvent pas avoir de stock.',
                'errors' => ['product_id' => ['Les services ne gèrent pas d\'inventaire.']],
            ], 422));
        }

        $validated['user_id'] = $userId;

        $stock = DB::transaction(function () use ($validated, $userId) {
            $stock = Stock::create($validated);
            $this->movements->recordInitial($stock, $userId);

            return $stock;
        });

        return $stock->load('product.brand', 'product.tyre');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    /**
     * @param  array<string, mixed>  $validated
     * @param  int|null  $userId
     * @return Stock
     */
    public function update(Stock $stock, array $validated, $userId)
    {
        $before = (int) $stock->quantity;
        $quantityChanged = array_key_exists('quantity', $validated) && (int) $validated['quantity'] !== $before;
        $reason = $validated['reason'] ?? '';
        unset($validated['reason']);

        DB::transaction(function () use ($stock, $validated, $quantityChanged, $before, $reason, $userId) {
            $stock->update($validated);

            if ($quantityChanged) {
                $this->movements->recordAdjustment(
                    $stock,
                    $before,
                    (int) $stock->quantity,
                    $reason,
                    $userId,
                );
            }
        });

        return $stock->fresh()->load('product.brand', 'product.tyre');
    }

    public function delete(Stock $stock, ?int $userId): void
    {
        DB::transaction(function () use ($stock, $userId) {
            $this->movements->recordDeletion($stock, $userId);
            $stock->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, int|float>
     */
    public function summary(array $filters = []): array
    {
        $query = $this->buildStockQuery($filters);

        $totalQuantity = (int) (clone $query)->sum('quantity');
        $totalValue = round((clone $query)->selectRaw('SUM(quantity * purchase_price) as total')->value('total') ?? 0, 2);

        // Repères ajoutés par la refonte 2b. Ils portent sur les références du
        // périmètre filtré, pas sur les lots : c'est la référence qu'on
        // réapprovisionne, pas le lot.
        $byProduct = (clone $query)->getQuery()
            ->reorder()
            ->select('stocks.product_id')
            ->selectRaw('SUM(stocks.quantity) as quantity')
            ->selectRaw('SUM(stocks.quantity * stocks.purchase_price) as value')
            ->groupBy('stocks.product_id')
            ->get();

        $productIds = $byProduct->pluck('product_id')->filter()->all();
        $sold30 = $productIds ? $this->soldQuantities($productIds, 30) : [];
        $sold180 = $productIds ? $this->soldQuantities($productIds, 180) : [];

        $lowStock = 0;
        $zero = 0;
        $dormantCount = 0;
        $dormantValue = 0.0;

        foreach ($byProduct as $row) {
            $quantity = (int) $row->quantity;
            $productId = (int) $row->product_id;

            if ($quantity <= 0) {
                $zero++;
            }
            // Même règle que le filtre rapide « sous seuil » : il faut que la
            // référence se vende pour qu'un manque ait un sens. Un stock
            // négatif sans vente est une anomalie de saisie, pas un manque.
            if (($sold30[$productId] ?? 0) > 0 && $quantity < ($sold30[$productId] ?? 0)) {
                $lowStock++;
            }
            if (($sold180[$productId] ?? 0) === 0 && $quantity > 0) {
                $dormantCount++;
                $dormantValue += (float) $row->value;
            }
        }

        $soldLast30 = array_sum($sold30);

        return [
            'total_articles' => (clone $query)->count(),
            'total_quantity' => $totalQuantity,
            'total_purchase_value' => $totalValue,
            'references_count' => $byProduct->count(),
            'depots_count' => (clone $query)->getQuery()->reorder()->distinct()->count('stocks.depot'),
            'low_stock_count' => $lowStock,
            'zero_count' => $zero,
            'dormant_days' => 180,
            'dormant_count' => $dormantCount,
            'dormant_value' => round($dormantValue, 2),
            // Couverture : combien de jours le stock tient au rythme des 30
            // derniers jours. Null quand rien ne s'est vendu — une division
            // par zéro n'est pas une couverture infinie, c'est une absence
            // de mesure.
            'coverage_days' => $soldLast30 > 0 ? (int) round($totalQuantity / ($soldLast30 / 30)) : null,
        ];
    }

    /**
     * Refonte 2b — Stock groupé par référence.
     *
     * L'écran actuel affiche une ligne par lot : la même référence revient
     * autant de fois qu'elle a de dépôts, de zones et de DOT. Ici une ligne
     * par référence, ses lots dépliables en dessous, et la pagination porte
     * sur les références et non plus sur les lots.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function grouped(array $filters = []): array
    {
        $perPage = max(1, (int) ($filters['per_page'] ?? 25));
        $page = max(1, (int) ($filters['page'] ?? 1));

        // Les identifiants de référence qui passent les filtres, classés par
        // valeur de stock décroissante : c'est sur eux que porte la pagination.
        // reorder() : le tri par défaut de buildStockQuery porte sur des colonnes
        // de lot (quantity, id) qui n'ont plus de sens — et que MySQL refuse —
        // une fois la requête groupée par référence.
        $idsQuery = $this->buildStockQuery($filters)
            ->getQuery()
            ->reorder()
            ->select('stocks.product_id')
            ->selectRaw('SUM(stocks.quantity * stocks.purchase_price) as stock_value')
            ->selectRaw('SUM(stocks.quantity) as stock_quantity')
            ->groupBy('stocks.product_id');

        $direction = ($filters['sort_direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $idsQuery->orderBy(
            ($filters['sort_by'] ?? null) === 'quantity' ? 'stock_quantity' : 'stock_value',
            $direction,
        );

        $allIds = collect(DB::table(DB::raw("({$idsQuery->toSql()}) as grouped_ids"))
            ->mergeBindings($idsQuery)
            ->pluck('product_id'));

        // Filtres rapides « sous seuil » et « dormant ». Ils se lisent sur les
        // ventes, pas sur une colonne : on restreint donc la liste des
        // références après coup, avant de paginer.
        if (! empty($filters['low_stock']) || ! empty($filters['dormant'])) {
            $ids = $allIds->all();
            $quantities = $this->stockQuantities($ids);

            if (! empty($filters['low_stock'])) {
                $sold30 = $this->soldQuantities($ids, 30);
                $allIds = $allIds->filter(
                    fn ($id) => ($sold30[$id] ?? 0) > 0 && ($quantities[$id] ?? 0) < ($sold30[$id] ?? 0)
                )->values();
            }

            if (! empty($filters['dormant'])) {
                $sold180 = $this->soldQuantities($ids, 180);
                $allIds = $allIds->filter(
                    fn ($id) => ($sold180[$id] ?? 0) === 0 && ($quantities[$id] ?? 0) > 0
                )->values();
            }
        }

        $total = $allIds->count();
        $pageIds = $allIds->forPage($page, $perPage)->values();

        $rows = $pageIds->isEmpty() ? collect() : $this->buildGroupedRows($pageIds->all(), $filters);

        return [
            'data' => $rows->all(),
            'total' => $total,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'per_page' => $perPage,
        ];
    }

    /**
     * @param  array<int, int>  $productIds
     * @param  array<string, mixed>  $filters
     */
    private function buildGroupedRows(array $productIds, array $filters): Collection
    {
        // Tous les lots des références retenues — y compris ceux à zéro, gardés
        // sous leur référence pour l'historique (cas explicite du handoff).
        $lots = Stock::with('product.brand', 'product.tyre')
            ->whereIn('product_id', $productIds)
            ->orderByDesc('quantity')
            ->orderByDesc('id')
            ->get()
            ->groupBy('product_id');

        $sold30 = $this->soldQuantities($productIds, 30);
        $sold180 = $this->soldQuantities($productIds, 180);

        return collect($productIds)->map(function (int $productId) use ($lots, $sold30, $sold180) {
            $productLots = $lots->get($productId, collect());
            $product = $productLots->first()?->product;
            $tyre = $product?->tyre;

            $quantity = (int) $productLots->sum('quantity');
            $value = round((float) $productLots->sum(fn (Stock $lot) => $lot->quantity * (float) $lot->purchase_price), 2);

            $byDepot = $productLots
                ->groupBy(fn (Stock $lot) => $lot->depot ?: 'Sans dépôt')
                ->map(fn ($group, $depot) => [
                    'depot' => $depot,
                    'quantity' => (int) $group->sum('quantity'),
                ])
                ->sortByDesc('quantity')
                ->values()
                ->all();

            return [
                'product_id' => $productId,
                'dimension' => $tyre ? $this->formatTyreDimension($tyre) : null,
                'brand' => $product?->brand?->name,
                'profile' => $product?->profile,
                'reference' => $product?->reference,
                'load_index' => $tyre?->tire_load_index,
                'speed_index' => $tyre?->tire_speed_index,
                'season' => $tyre?->tire_season,
                'runflat' => (bool) ($tyre?->tire_runflat ?? false),
                'marking' => $tyre?->tire_marking,
                'quantity' => $quantity,
                'value' => $value,
                'unit_price' => $quantity > 0 ? round($value / $quantity, 2) : null,
                'lots_count' => $productLots->count(),
                'by_depot' => $byDepot,
                'sold_30d' => (int) ($sold30[$productId] ?? 0),
                'sold_180d' => (int) ($sold180[$productId] ?? 0),
                'lots' => $productLots->map(fn (Stock $lot) => [
                    'id' => $lot->id,
                    'dot' => $lot->dot,
                    'made_in' => $lot->made_in,
                    'depot' => $lot->depot,
                    'zone' => $lot->zone,
                    'quantity' => (int) $lot->quantity,
                    'purchase_price' => round((float) $lot->purchase_price, 2),
                    'value' => round($lot->quantity * (float) $lot->purchase_price, 2),
                ])->values()->all(),
            ];
        });
    }

    /**
     * Quantités vendues par référence sur les N derniers jours — la base des
     * deux repères de l'écran : « moins d'un mois de ventes en stock » et
     * « dormant ». Aucun seuil de réapprovisionnement n'existe dans le modèle
     * de données ; ces repères se lisent donc sur les ventes réelles.
     *
     * @param  array<int, int>  $productIds
     * @return array<int, int>
     */
    private function soldQuantities(array $productIds, int $days): array
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereIn('sale_items.product_id', $productIds)
            ->where('sales.status', '!=', 'ANNULE')
            ->where('sales.date', '>=', now()->subDays($days)->toDateString())
            ->selectRaw('sale_items.product_id, SUM(sale_items.quantity) as sold')
            ->groupBy('sale_items.product_id')
            ->pluck('sold', 'product_id')
            ->map(fn ($sold) => (int) $sold)
            ->all();
    }

    /**
     * @param  array<int, int>  $productIds
     * @return array<int, int>
     */
    private function stockQuantities(array $productIds): array
    {
        return DB::table('stocks')
            ->whereIn('product_id', $productIds)
            ->selectRaw('product_id, SUM(quantity) as quantity')
            ->groupBy('product_id')
            ->pluck('quantity', 'product_id')
            ->map(fn ($quantity) => (int) $quantity)
            ->all();
    }

    private function formatTyreDimension($tyre): ?string
    {
        if (! $tyre?->tire_width || ! $tyre?->tire_height || ! $tyre?->tire_diameter) {
            return null;
        }

        return sprintf('%d/%dR%d', (int) $tyre->tire_width, (int) $tyre->tire_height, (int) $tyre->tire_diameter);
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        $stockProductIds = Stock::distinct()->pluck('product_id')->filter();

        return [
            'brands' => Brand::whereHas('products', function ($q) use ($stockProductIds) {
                $q->whereIn('id', $stockProductIds);
            })->orderBy('name')->pluck('name')->values(),
            'depots' => Stock::distinct()->whereNotNull('depot')->where('depot', '!=', '')->pluck('depot')->sort()->values(),
            'zones' => Stock::distinct()->whereNotNull('zone')->where('zone', '!=', '')->pluck('zone')->sort()->values(),
            'countries' => Stock::distinct()->whereNotNull('made_in')->where('made_in', '!=', '')->pluck('made_in')->sort()->values(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function exportAvailable(array $filters = []): StreamedResponse
    {
        $filters['in_stock'] = 1;

        $fileName = 'stock-disponible-' . now()->format('Y-m-d-His') . '.xlsx';
        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            'Cache-Control' => 'max-age=0, no-store, no-cache, must-revalidate',
            'Pragma' => 'public',
        ];

        return response()->streamDownload(function () use ($filters) {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Stock disponible');

            $rows = [
                [
                    'Marque',
                    'Reference',
                    'Profil',
                    'Type',
                    'Dimensions',
                    'Marquage',
                    'Depot',
                    'Zone',
                    'Pays',
                    'DOT',
                    'Quantite',
                    'Prix achat',
                    'Valeur achat',
                ],
            ];

            $this->buildStockQuery($filters)
                ->get()
                ->each(function (Stock $stock) use (&$rows) {
                    $product = $stock->product;
                    $tyre = $product ? $product->tyre : null;
                    $quantity = (int) $stock->quantity;
                    $purchasePrice = $stock->purchase_price !== null ? (float) $stock->purchase_price : null;
                    $totalValue = $purchasePrice !== null ? round($quantity * $purchasePrice, 2) : null;

                    $dimensions = $tyre
                        ? trim(implode('/', array_filter([
                            $tyre->tire_width,
                            $tyre->tire_height,
                            $tyre->tire_diameter,
                        ], function ($value) {
                            return $value !== null && $value !== '';
                        })))
                        : '';

                    $rows[] = [
                        $product && $product->brand ? $product->brand->name : '',
                        $product ? $product->reference : '',
                        $product ? $product->profile : '',
                        $product ? $product->type : '',
                        $dimensions,
                        $tyre ? $tyre->tire_marking : '',
                        $stock->depot ?: '',
                        $stock->zone ?: '',
                        $stock->made_in ?: '',
                        $stock->dot ?: '',
                        $quantity,
                        $purchasePrice !== null ? $purchasePrice : null,
                        $totalValue !== null ? $totalValue : null,
                    ];
                });

            $sheet->fromArray($rows, null, 'A1', true);
            $sheet->getStyle('A1:M1')->getFont()->setBold(true);
            $sheet->freezePane('A2');

            foreach (range('A', 'M') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $sheet->getStyle('L2:M' . max(count($rows), 2))
                ->getNumberFormat()
                ->setFormatCode('#,##0.00');

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }, $fileName, $headers);
    }

    public function import(UploadedFile $file, int $userId): array
    {
        $spreadsheet = IOFactory::load($file->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        array_shift($rows);

        if (count($rows) > 10000) {
            abort(response()->json([
                'message' => 'Fichier trop volumineux (maximum 10 000 lignes).',
            ], 422));
        }

        $count = 0;

        DB::transaction(function () use ($rows, $userId, &$count) {
            foreach ($rows as $row) {
                $brand = trim($row['A'] ?? '');
                if ($brand === '') {
                    continue;
                }

                $qty = is_numeric($row['K'] ?? null) ? (int) $row['K'] : 0;

                $stock = Stock::create([
                    'product_id' => null,
                    'made_in' => trim($row['G'] ?? '') ?: null,
                    'dot' => isset($row['H']) ? trim((string) $row['H']) ?: null : null,
                    'depot' => $this->normalizeDepot($row['I'] ?? ''),
                    'zone' => trim($row['J'] ?? '') ?: null,
                    'quantity' => $qty,
                    'purchase_price' => is_numeric($row['M'] ?? null) ? round((float) $row['M'], 2) : null,
                    'user_id' => $userId,
                ]);

                $this->movements->recordImport($stock, $qty, $userId);
                $count++;
            }
        });

        return [
            'message' => "{$count} articles importés avec succès.",
            'count' => $count,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator|Collection
     */
    public function movementList(array $filters = [])
    {
        $query = StockMovement::query()
            ->with(['user:id,name', 'stock:id,depot,zone'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (! empty($filters['stock_id'])) {
            $query->where('stock_id', $filters['stock_id']);
        }

        if (! empty($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to']);
        }

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 50));
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function buildStockQuery(array $filters): Builder
    {
        $query = Stock::with('product.brand', 'product.tyre');

        $query->whereHas('product', function ($pq) {
            $pq->whereIn('type', ['tyre', 'part']);
        });

        if (! empty($filters['search'])) {
            $parsed = Stock::parseSearchQuery($filters['search']);

            if ($parsed['width'] || $parsed['height'] || $parsed['diameter']) {
                $query->whereHas('product.tyre', function ($pq) use ($parsed) {
                    if ($parsed['width']) {
                        $pq->where('tire_width', $parsed['width']);
                    }
                    if ($parsed['height']) {
                        $pq->where('tire_height', $parsed['height']);
                    }
                    if ($parsed['diameter']) {
                        $pq->where('tire_diameter', $parsed['diameter']);
                    }
                });
            }

            if ($parsed['brand_prefix']) {
                $prefix = $parsed['brand_prefix'];
                $query->whereHas('product.brand', function ($bq) use ($prefix) {
                    $bq->where('name', 'like', "{$prefix}%");
                });
            }

            foreach ($parsed['text'] as $term) {
                $query->where(function ($q) use ($term) {
                    $q->where('depot', 'like', "%{$term}%")
                        ->orWhereHas('product', function ($pq) use ($term) {
                            $pq->where('profile', 'like', "%{$term}%")
                                ->orWhere('reference', 'like', "%{$term}%")
                                ->orWhereHas('tyre', function ($tq) use ($term) {
                                    $tq->where('tire_marking', 'like', "%{$term}%");
                                })
                                ->orWhereHas('brand', function ($bq) use ($term) {
                                    $bq->where('name', 'like', "%{$term}%");
                                });
                        });
                });
            }
        }

        if (! empty($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        if (! empty($filters['brand'])) {
            $query->whereHas('product.brand', function ($bq) use ($filters) {
                $bq->where('name', $filters['brand']);
            });
        }

        if (! empty($filters['depot'])) {
            $query->where('depot', $filters['depot']);
        }

        if (! empty($filters['made_in'])) {
            $query->where('made_in', $filters['made_in']);
        }

        if (! empty($filters['in_stock'])) {
            $query->where('quantity', '>', 0);
        }

        if (! empty($filters['rft'])) {
            $query->whereHas('product.tyre', function ($tq) {
                $tq->where('tire_runflat', true);
            });
        }

        $sortable = ['quantity', 'purchase_price', 'depot', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->orderByDesc('quantity')->orderByDesc('id');
        }

        return $query;
    }

    private function normalizeDepot(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        $value = preg_replace('/\s+/', '', $value);

        return ucfirst(strtolower((string) $value));
    }
}
