<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class StockController extends Controller
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

    public function index(Request $request): JsonResponse
    {
        $query = Stock::with('product.brand', 'product.tyre');

        // Services never appear in inventory
        $query->whereHas('product', function ($pq) {
            $pq->whereIn('type', ['tyre', 'part']);
        });

        // Smart search — queries product fields
        if ($request->filled('search')) {
            $parsed = Stock::parseSearchQuery($request->search);

            if ($parsed['width'] || $parsed['height'] || $parsed['diameter']) {
                $query->whereHas('product.tyre', function ($pq) use ($parsed) {
                    if ($parsed['width']) $pq->where('tire_width', $parsed['width']);
                    if ($parsed['height']) $pq->where('tire_height', $parsed['height']);
                    if ($parsed['diameter']) $pq->where('tire_diameter', $parsed['diameter']);
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

        // Filter by product_id
        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        // Filters
        if ($request->filled('brand')) {
            $query->whereHas('product.brand', function ($bq) use ($request) {
                $bq->where('name', $request->brand);
            });
        }
        if ($request->filled('depot')) {
            $query->where('depot', $request->depot);
        }
        if ($request->filled('made_in')) {
            $query->where('made_in', $request->made_in);
        }
        if ($request->boolean('in_stock')) {
            $query->where('quantity', '>', 0);
        }
        if ($request->boolean('rft')) {
            $query->whereHas('product.tyre', function ($tq) {
                $tq->where('tire_runflat', true);
            });
        }

        // Sorting
        $stockSortable = ['quantity', 'purchase_price', 'depot', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $stockSortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->orderByDesc('quantity')->orderByDesc('id');
        }

        return response()->json($query->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'required|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
        ]);

        // Services don't have stock
        $product = \App\Models\Product::find($validated['product_id']);
        if ($product && $product->type === 'service') {
            return response()->json([
                'message' => 'Les services ne peuvent pas avoir de stock.',
                'errors' => ['product_id' => ['Les services ne gèrent pas d\'inventaire.']],
            ], 422);
        }

        $userId = $request->user()->id;
        $validated['user_id'] = $userId;

        $stock = DB::transaction(function () use ($validated, $userId) {
            $stock = Stock::create($validated);
            $this->movements->recordInitial($stock, $userId);
            return $stock;
        });

        $stock->load('product.brand');

        return response()->json($stock, 201);
    }

    public function show(Stock $stock): JsonResponse
    {
        $stock->load('product.brand');

        return response()->json($stock);
    }

    public function update(Request $request, Stock $stock): JsonResponse
    {
        $rules = [
            'product_id' => 'sometimes|exists:products,id',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'sometimes|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'reason' => 'nullable|string|max:1000',
        ];

        $before = (int) $stock->quantity;
        $quantityChanged = $request->has('quantity') && (int) $request->input('quantity') !== $before;

        if ($quantityChanged) {
            $rules['reason'] = 'required|string|min:3|max:1000';
        }

        $validated = $request->validate($rules);
        $reason = $validated['reason'] ?? null;
        unset($validated['reason']);

        $userId = $request->user()->id;

        DB::transaction(function () use ($stock, $validated, $quantityChanged, $before, $reason, $userId) {
            $stock->update($validated);

            if ($quantityChanged) {
                $this->movements->recordAdjustment(
                    $stock,
                    $before,
                    (int) $stock->quantity,
                    $reason ?? '',
                    $userId
                );
            }
        });

        $stock->load('product.brand');

        return response()->json($stock);
    }

    public function destroy(Request $request, Stock $stock): JsonResponse
    {
        $userId = $request->user() ? $request->user()->id : null;

        DB::transaction(function () use ($stock, $userId) {
            $this->movements->recordDeletion($stock, $userId);
            $stock->delete();
        });

        return response()->json(null, 204);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Stock::query();

        // Services never appear in inventory
        $query->whereHas('product', function ($pq) {
            $pq->whereIn('type', ['tyre', 'part']);
        });

        if ($request->filled('search')) {
            $parsed = Stock::parseSearchQuery($request->search);
            if ($parsed['width'] || $parsed['height'] || $parsed['diameter']) {
                $query->whereHas('product.tyre', function ($pq) use ($parsed) {
                    if ($parsed['width']) $pq->where('tire_width', $parsed['width']);
                    if ($parsed['height']) $pq->where('tire_height', $parsed['height']);
                    if ($parsed['diameter']) $pq->where('tire_diameter', $parsed['diameter']);
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
                    $q->whereHas('product', function ($pq) use ($term) {
                        $pq->where('profile', 'like', "%{$term}%");
                    });
                });
            }
        }

        if ($request->filled('brand')) {
            $query->whereHas('product.brand', function ($bq) use ($request) {
                $bq->where('name', $request->brand);
            });
        }
        if ($request->filled('depot')) {
            $query->where('depot', $request->depot);
        }
        if ($request->boolean('in_stock')) {
            $query->where('quantity', '>', 0);
        }
        if ($request->boolean('rft')) {
            $query->whereHas('product.tyre', function ($tq) {
                $tq->where('tire_runflat', true);
            });
        }

        // selling_price now comes from product via join
        $baseQuery = clone $query;

        return response()->json([
            'total_articles' => (clone $query)->count(),
            'total_quantity' => (int) (clone $query)->sum('quantity'),
            'total_purchase_value' => round((clone $query)->selectRaw('SUM(quantity * purchase_price) as total')->value('total') ?? 0, 2),
        ]);
    }

    public function filters(): JsonResponse
    {
        $stockProductIds = Stock::distinct()->pluck('product_id')->filter();

        return response()->json([
            'brands' => \App\Models\Brand::whereHas('products', function ($q) use ($stockProductIds) {
                $q->whereIn('id', $stockProductIds);
            })->orderBy('name')->pluck('name')->values(),
            'depots' => Stock::distinct()->whereNotNull('depot')->where('depot', '!=', '')->pluck('depot')->sort()->values(),
            'zones' => Stock::distinct()->whereNotNull('zone')->where('zone', '!=', '')->pluck('zone')->sort()->values(),
            'countries' => Stock::distinct()->whereNotNull('made_in')->where('made_in', '!=', '')->pluck('made_in')->sort()->values(),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            // max:5120 KB = 5 MB, enough for ~50k rows in practice
            'file' => 'required|file|mimes:xlsx,xls|max:5120',
        ]);

        $spreadsheet = IOFactory::load($request->file('file')->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        // Remove header row
        $header = array_shift($rows);

        // Hard row cap to protect DB rollback segment and PHP memory even
        // when the file is under the size cap but densely packed.
        if (count($rows) > 10000) {
            return response()->json([
                'message' => 'Fichier trop volumineux (maximum 10 000 lignes).',
            ], 422);
        }

        $count = 0;
        $userId = $request->user()->id;

        DB::transaction(function () use ($rows, $userId, &$count) {
            foreach ($rows as $row) {
                $brand = trim($row['A'] ?? '');
                if ($brand === '') continue;

                $qty = is_numeric($row['K'] ?? null) ? (int) $row['K'] : 0;

                $stock = Stock::create([
                    'product_id' => null, // Import keeps as-is for now
                    'made_in' => trim($row['G'] ?? '') ?: null,
                    'dot' => isset($row['H']) ? trim((string) $row['H']) ?: null : null,
                    'depot' => self::normalizeDepot($row['I'] ?? ''),
                    'zone' => trim($row['J'] ?? '') ?: null,
                    'quantity' => $qty,
                    'purchase_price' => is_numeric($row['M'] ?? null) ? round((float) $row['M'], 2) : null,
                    'user_id' => $userId,
                ]);

                $this->movements->recordImport($stock, $qty, $userId);
                $count++;
            }
        });

        return response()->json([
            'message' => "{$count} articles importés avec succès.",
            'count' => $count,
        ]);
    }

    /**
     * @param string $value
     * @return string|null
     */
    private static function normalizeDepot($value)
    {
        $v = trim($value);
        if ($v === '') return null;

        $v = preg_replace('/\s+/', '', $v);
        return ucfirst(strtolower($v));
    }
}