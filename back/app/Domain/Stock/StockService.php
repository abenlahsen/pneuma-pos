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

        return [
            'total_articles' => (clone $query)->count(),
            'total_quantity' => (int) (clone $query)->sum('quantity'),
            'total_purchase_value' => round((clone $query)->selectRaw('SUM(quantity * purchase_price) as total')->value('total') ?? 0, 2),
        ];
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
