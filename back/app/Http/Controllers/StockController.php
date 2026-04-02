<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;

class StockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Stock::query();

        // Smart search
        if ($request->filled('search')) {
            $parsed = Stock::parseSearchQuery($request->search);

            if ($parsed['width']) {
                $query->where('width', $parsed['width']);
            }
            if ($parsed['height']) {
                $query->where('height', $parsed['height']);
            }
            if ($parsed['diameter']) {
                $query->where('diameter', $parsed['diameter']);
            }
            foreach ($parsed['text'] as $term) {
                $query->where(function ($q) use ($term) {
                    $q->where('brand', 'like', "%{$term}%")
                      ->orWhere('profile', 'like', "%{$term}%")
                      ->orWhere('dimension', 'like', "%{$term}%")
                      ->orWhere('marking', 'like', "%{$term}%")
                      ->orWhere('depot', 'like', "%{$term}%");
                });
            }
        }

        // Filters
        if ($request->filled('brand')) {
            $query->where('brand', $request->brand);
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

        // Sorting
        $sortable = ['brand', 'dimension', 'profile', 'quantity', 'purchase_price', 'selling_price', 'depot', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->orderByDesc('quantity')->orderByRaw('brand IS NULL, brand ASC')->orderByDesc('id');
        }

        return response()->json($query->paginate($request->get('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brand' => 'nullable|string|max:255',
            'profile' => 'nullable|string|max:255',
            'dimension' => 'nullable|string|max:100',
            'ic' => 'nullable|string|max:50',
            'iv' => 'nullable|string|max:10',
            'rft' => 'nullable|boolean',
            'reinforced' => 'nullable|boolean',
            'marking' => 'nullable|string|max:255',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'required|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'special_price' => 'nullable|numeric|min:0',
        ]);

        $validated['user_id'] = $request->user()->id;

        $stock = Stock::create($validated);

        return response()->json($stock, 201);
    }

    public function show(Stock $stock): JsonResponse
    {
        return response()->json($stock);
    }

    public function update(Request $request, Stock $stock): JsonResponse
    {
        $validated = $request->validate([
            'brand' => 'nullable|string|max:255',
            'profile' => 'nullable|string|max:255',
            'dimension' => 'nullable|string|max:100',
            'ic' => 'nullable|string|max:50',
            'iv' => 'nullable|string|max:10',
            'rft' => 'nullable|boolean',
            'reinforced' => 'nullable|boolean',
            'marking' => 'nullable|string|max:255',
            'made_in' => 'nullable|string|max:100',
            'dot' => 'nullable|string|max:50',
            'depot' => 'nullable|string|max:100',
            'zone' => 'nullable|string|max:50',
            'quantity' => 'sometimes|integer|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'special_price' => 'nullable|numeric|min:0',
        ]);

        $stock->update($validated);

        return response()->json($stock);
    }

    public function destroy(Stock $stock): JsonResponse
    {
        $stock->delete();

        return response()->json(null, 204);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Stock::query();

        if ($request->filled('search')) {
            $parsed = Stock::parseSearchQuery($request->search);
            if ($parsed['width']) $query->where('width', $parsed['width']);
            if ($parsed['height']) $query->where('height', $parsed['height']);
            if ($parsed['diameter']) $query->where('diameter', $parsed['diameter']);
            foreach ($parsed['text'] as $term) {
                $query->where(function ($q) use ($term) {
                    $q->where('brand', 'like', "%{$term}%")
                      ->orWhere('profile', 'like', "%{$term}%")
                      ->orWhere('dimension', 'like', "%{$term}%");
                });
            }
        }

        if ($request->filled('brand')) $query->where('brand', $request->brand);
        if ($request->filled('depot')) $query->where('depot', $request->depot);
        if ($request->boolean('in_stock')) $query->where('quantity', '>', 0);

        return response()->json([
            'total_articles' => (clone $query)->count(),
            'total_quantity' => (int) (clone $query)->sum('quantity'),
            'total_purchase_value' => round((clone $query)->selectRaw('SUM(quantity * purchase_price) as total')->value('total') ?? 0, 2),
            'total_selling_value' => round((clone $query)->selectRaw('SUM(quantity * selling_price) as total')->value('total') ?? 0, 2),
        ]);
    }

    public function filters(): JsonResponse
    {
        return response()->json([
            'brands' => Stock::distinct()->whereNotNull('brand')->where('brand', '!=', '')->pluck('brand')->sort()->values(),
            'depots' => Stock::distinct()->whereNotNull('depot')->where('depot', '!=', '')->pluck('depot')->sort()->values(),
            'zones' => Stock::distinct()->whereNotNull('zone')->where('zone', '!=', '')->pluck('zone')->sort()->values(),
            'countries' => Stock::distinct()->whereNotNull('made_in')->where('made_in', '!=', '')->pluck('made_in')->sort()->values(),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
        ]);

        $spreadsheet = IOFactory::load($request->file('file')->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        // Remove header row
        $header = array_shift($rows);

        $count = 0;
        $userId = $request->user()->id;

        foreach (array_chunk($rows, 100) as $chunk) {
            $records = [];
            foreach ($chunk as $row) {
                $brand = trim($row['A'] ?? '');
                if ($brand === '') continue;

                $dimension = trim($row['C'] ?? '');
                $parsed = Stock::parseDimension($dimension);
                $qty = is_numeric($row['K'] ?? null) ? (int) $row['K'] : 0;

                $records[] = [
                    'brand' => $brand,
                    'profile' => trim($row['B'] ?? '') ?: null,
                    'dimension' => $dimension ?: null,
                    'width' => $parsed['width'],
                    'height' => $parsed['height'],
                    'diameter' => $parsed['diameter'],
                    'ic' => isset($row['D']) ? trim((string) $row['D']) ?: null : null,
                    'iv' => isset($row['E']) ? trim((string) $row['E']) ?: null : null,
                    'rft' => ! empty($row['F']),
                    'reinforced' => false,
                    'marking' => null,
                    'made_in' => trim($row['G'] ?? '') ?: null,
                    'dot' => isset($row['H']) ? trim((string) $row['H']) ?: null : null,
                    'depot' => self::normalizeDepot($row['I'] ?? ''),
                    'zone' => trim($row['J'] ?? '') ?: null,
                    'quantity' => $qty,
                    'purchase_price' => is_numeric($row['M'] ?? null) ? round((float) $row['M'], 2) : null,
                    'selling_price' => is_numeric($row['O'] ?? null) ? round((float) $row['O'], 2) : null,
                    'special_price' => is_numeric($row['P'] ?? null) ? round((float) $row['P'], 2) : null,
                    'user_id' => $userId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $count++;
            }
            Stock::insert($records);
        }

        return response()->json([
            'message' => "{$count} articles importés avec succès.",
            'count' => $count,
        ]);
    }

    private static function normalizeDepot(string $value): ?string
    {
        $v = trim($value);
        if ($v === '') return null;

        // Normalize: "depot1", "DEPOT1", "Depot1", "depot 1" → "Depot1"
        $v = preg_replace('/\s+/', '', $v); // remove spaces
        return ucfirst(strtolower($v));
    }
}
