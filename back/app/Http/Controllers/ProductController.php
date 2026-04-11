<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Stock;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct(private readonly StockMovementService $movements)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['brand', 'tyre', 'part', 'service']);

        // Search — base fields + OEM reference (parts)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('profile', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('brand', function ($bq) use ($search) {
                      $bq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('part', function ($pq) use ($search) {
                      $pq->where('oem_reference', 'like', "%{$search}%")
                         ->orWhere('compatibility', 'like', "%{$search}%");
                  });
            });
        }

        // Filters
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('brand_id')) {
            $query->where('brand_id', $request->brand_id);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('tire_season')) {
            $query->whereHas('tyre', function ($q) use ($request) {
                $q->where('tire_season', $request->tire_season);
            });
        }
        if ($request->filled('part_category')) {
            $query->whereHas('part', function ($q) use ($request) {
                $q->where('category', $request->part_category);
            });
        }
        if ($request->filled('service_category')) {
            $query->whereHas('service', function ($q) use ($request) {
                $q->where('category', $request->service_category);
            });
        }

        // Sorting
        $sortable = ['reference', 'type', 'created_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->orderBy('id', 'desc');
        }

        return response()->json($query->paginate($request->get('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->validationRules());

        $userId = $request->user()?->id;

        $product = DB::transaction(function () use ($validated, $userId) {
            $product = Product::create([
                'profile' => $validated['profile'] ?? null,
                'reference' => $validated['reference'] ?? null,
                'type' => $validated['type'],
                'brand_id' => $validated['brand_id'] ?? null,
                'description' => $validated['description'] ?? null,
                'unit' => $validated['unit'] ?? 'piece',
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $this->upsertDetails($product, $validated);

            // Auto-create an initial empty stock row only for physical products
            if ($product->type !== 'service') {
                $stock = Stock::create([
                    'product_id' => $product->id,
                    'quantity' => 0,
                    'user_id' => $userId,
                ]);
                $this->movements->recordAutoCreate($stock, $userId);
            }

            return $product;
        });

        $product->load(['brand', 'tyre', 'part', 'service']);

        return response()->json($product, 201);
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['brand', 'tyre', 'part', 'service']);

        return response()->json($product);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate($this->validationRules());

        DB::transaction(function () use ($product, $validated) {
            $product->update([
                'profile' => $validated['profile'] ?? null,
                'reference' => $validated['reference'] ?? null,
                'type' => $validated['type'],
                'brand_id' => $validated['brand_id'] ?? null,
                'description' => $validated['description'] ?? null,
                'unit' => $validated['unit'] ?? 'piece',
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $this->upsertDetails($product, $validated);
        });

        $product->load(['brand', 'tyre', 'part', 'service']);

        return response()->json($product);
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(null, 204);
    }

    public function toggleActive(Product $product): JsonResponse
    {
        $product->update(['is_active' => !$product->is_active]);
        $product->load(['brand', 'tyre', 'part', 'service']);

        return response()->json($product);
    }

    public function filters(): JsonResponse
    {
        return response()->json([
            'brands' => \App\Models\Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'types' => ['tyre', 'part', 'service'],
            'seasons' => ['summer', 'winter', 'all_season'],
            'part_categories' => ['brakes', 'lubricants', 'engine', 'suspension', 'filters', 'electrical', 'body', 'other'],
            'service_categories' => ['mechanical', 'oil', 'tires', 'bodywork', 'diagnostic', 'other'],
            'units' => Product::distinct()->whereNotNull('unit')->where('unit', '!=', '')->pluck('unit')->sort()->values(),
        ]);
    }

    /**
     * Create or update the type-specific sub-row for a product.
     */
    private function upsertDetails(Product $product, array $validated): void
    {
        switch ($product->type) {
            case 'tyre':
                $data = [
                    'tire_width' => $validated['tire_width'] ?? null,
                    'tire_height' => $validated['tire_height'] ?? null,
                    'tire_diameter' => $validated['tire_diameter'] ?? null,
                    'tire_load_index' => $validated['tire_load_index'] ?? null,
                    'tire_speed_index' => $validated['tire_speed_index'] ?? null,
                    'tire_season' => $validated['tire_season'] ?? null,
                    'tire_runflat' => $validated['tire_runflat'] ?? false,
                    'tire_reinforced' => $validated['tire_reinforced'] ?? false,
                    'tire_marking' => $validated['tire_marking'] ?? null,
                    'eu_fuel' => $validated['eu_fuel'] ?? null,
                    'eu_wet_grip' => $validated['eu_wet_grip'] ?? null,
                    'eu_noise_db' => $validated['eu_noise_db'] ?? null,
                    'eu_noise_class' => $validated['eu_noise_class'] ?? null,
                ];
                $product->tyre()->updateOrCreate(['product_id' => $product->id], $data);
                $product->part()->delete();
                $product->service()->delete();
                break;

            case 'part':
                $data = [
                    'category' => $validated['part_category'] ?? 'other',
                    'oem_reference' => $validated['oem_reference'] ?? null,
                    'compatibility' => $validated['compatibility'] ?? null,
                ];
                $product->part()->updateOrCreate(['product_id' => $product->id], $data);
                $product->tyre()->delete();
                $product->service()->delete();
                break;

            case 'service':
                $data = [
                    'category' => $validated['service_category'] ?? 'other',
                    'duration_minutes' => $validated['duration_minutes'] ?? null,
                    'selling_price' => $validated['selling_price'] ?? null,
                ];
                $product->service()->updateOrCreate(['product_id' => $product->id], $data);
                $product->tyre()->delete();
                $product->part()->delete();
                break;
        }
    }

    private function validationRules(): array
    {
        return [
            // Base
            'profile' => 'nullable|string|max:255',
            'reference' => 'nullable|string|max:255',
            'type' => 'required|in:tyre,part,service',
            'brand_id' => 'nullable|exists:brands,id',
            'description' => 'nullable|string',
            'unit' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',

            // Tyre-specific
            'tire_width' => 'nullable|integer|min:0',
            'tire_height' => 'nullable|integer|min:0',
            'tire_diameter' => 'nullable|integer|min:0',
            'tire_load_index' => 'nullable|string|max:20',
            'tire_speed_index' => 'nullable|string|max:10',
            'tire_season' => 'nullable|in:summer,winter,all_season',
            'tire_runflat' => 'nullable|boolean',
            'tire_reinforced' => 'nullable|boolean',
            'tire_marking' => 'nullable|string|max:255',
            'eu_fuel' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_wet_grip' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_noise_db' => 'nullable|integer|min:0|max:999',
            'eu_noise_class' => 'nullable|string|size:1|in:A,B,C',

            // Part-specific
            'part_category' => 'nullable|in:brakes,lubricants,engine,suspension,filters,electrical,body,other',
            'oem_reference' => 'nullable|string|max:255',
            'compatibility' => 'nullable|string',

            // Service-specific
            'service_category' => 'nullable|in:mechanical,oil,tires,bodywork,diagnostic,other',
            'duration_minutes' => 'nullable|integer|min:0|max:10000',
            'selling_price' => 'nullable|numeric|min:0',
        ];
    }
}
