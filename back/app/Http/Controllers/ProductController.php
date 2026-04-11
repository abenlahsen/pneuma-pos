<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Stock;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly StockMovementService $movements)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Product::with('brand');

        // Search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('profile', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('brand', function ($bq) use ($search) {
                      $bq->where('name', 'like', "%{$search}%");
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
            $query->where('tire_season', $request->tire_season);
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

        $product = Product::create($validated);

        // Auto-create an initial empty stock row for the new product
        $stock = Stock::create([
            'product_id' => $product->id,
            'quantity' => 0,
            'user_id' => $userId,
        ]);

        $this->movements->recordAutoCreate($stock, $userId);

        $product->load('brand');

        return response()->json($product, 201);
    }

    public function show(Product $product): JsonResponse
    {
        $product->load('brand');

        return response()->json($product);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate($this->validationRules());

        $product->update($validated);
        $product->load('brand');

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
        $product->load('brand');

        return response()->json($product);
    }

    public function filters(): JsonResponse
    {
        return response()->json([
            'brands' => \App\Models\Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'types' => ['tyre', 'part'],
            'seasons' => ['summer', 'winter', 'all_season'],
            'units' => Product::distinct()->whereNotNull('unit')->where('unit', '!=', '')->pluck('unit')->sort()->values(),
        ]);
    }

    private function validationRules(): array
    {
        return [
            'profile' => 'nullable|string|max:255',
            'reference' => 'nullable|string|max:255',
            'type' => 'required|in:tyre,part',
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
            // EU tyre label
            'eu_fuel' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_wet_grip' => 'nullable|string|size:1|in:A,B,C,D,E,F,G',
            'eu_noise_db' => 'nullable|integer|min:0|max:999',
            'eu_noise_class' => 'nullable|string|size:1|in:A,B,C',
        ];
    }
}
