<?php

namespace App\Domain\Products;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Stock;
use App\Services\StockMovementService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProductService
{
    public function __construct(private StockMovementService $movements)
    {
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator|Collection
    {
        $query = $this->buildFilteredQuery($filters);

        if (! empty($filters['all'])) {
            return $query->get();
        }

        return $query->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function create(array $validated, ?int $userId): Product
    {
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

        return $this->loadRelations($product);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(Product $product, array $validated): Product
    {
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

        return $this->loadRelations($product);
    }

    public function delete(Product $product): void
    {
        $product->delete();
    }

    public function toggleActive(Product $product): Product
    {
        $product->update(['is_active' => ! $product->is_active]);

        return $this->loadRelations($product);
    }

    /**
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        return [
            'brands' => Brand::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'types' => ['tyre', 'part', 'service'],
            'seasons' => ['summer', 'winter', 'all_season'],
            'part_categories' => ['brakes', 'lubricants', 'engine', 'suspension', 'filters', 'electrical', 'body', 'other'],
            'service_categories' => ['mechanical', 'oil', 'tires', 'bodywork', 'diagnostic', 'other'],
            'units' => Product::distinct()->whereNotNull('unit')->where('unit', '!=', '')->pluck('unit')->sort()->values(),
            'profiles' => Product::distinct()->whereNotNull('profile')->where('profile', '!=', '')->orderBy('profile')->pluck('profile')->values(),
        ];
    }

    public function loadRelations(Product $product): Product
    {
        return $product->load(['brand', 'tyre', 'part', 'service']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function buildFilteredQuery(array $filters): Builder
    {
        $query = Product::with(['brand', 'tyre', 'part', 'service']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];

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

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (! empty($filters['brand_id'])) {
            $query->where('brand_id', $filters['brand_id']);
        }

        if (! empty($filters['profile'])) {
            $query->where('profile', $filters['profile']);
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? $filters['is_active']);
        }

        if (! empty($filters['tire_season'])) {
            $query->whereHas('tyre', function ($q) use ($filters) {
                $q->where('tire_season', $filters['tire_season']);
            });
        }

        if (! empty($filters['part_category'])) {
            $query->whereHas('part', function ($q) use ($filters) {
                $q->where('category', $filters['part_category']);
            });
        }

        if (! empty($filters['service_category'])) {
            $query->whereHas('service', function ($q) use ($filters) {
                $q->where('category', $filters['service_category']);
            });
        }

        $sortable = ['reference', 'type', 'created_at'];
        if (! empty($filters['sort_by']) && in_array($filters['sort_by'], $sortable, true)) {
            $direction = ($filters['sort_direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        } else {
            $query->orderBy('id', 'desc');
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function upsertDetails(Product $product, array $validated): void
    {
        switch ($product->type) {
            case 'tyre':
                $product->tyre()->updateOrCreate(
                    ['product_id' => $product->id],
                    [
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
                    ],
                );
                $product->part()->delete();
                $product->service()->delete();
                break;

            case 'part':
                $product->part()->updateOrCreate(
                    ['product_id' => $product->id],
                    [
                        'category' => $validated['part_category'] ?? 'other',
                        'oem_reference' => $validated['oem_reference'] ?? null,
                        'compatibility' => $validated['compatibility'] ?? null,
                    ],
                );
                $product->tyre()->delete();
                $product->service()->delete();
                break;

            case 'service':
                $product->service()->updateOrCreate(
                    ['product_id' => $product->id],
                    [
                        'category' => $validated['service_category'] ?? 'other',
                        'duration_minutes' => $validated['duration_minutes'] ?? null,
                        'selling_price' => $validated['selling_price'] ?? null,
                    ],
                );
                $product->tyre()->delete();
                $product->part()->delete();
                break;
        }
    }
}
