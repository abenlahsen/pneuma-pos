<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SaleService;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;

class SaleController extends Controller
{
    public function __construct(
        protected SaleService $saleService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()
            ->with(['linkedClient', 'commercial']);

        if ($request->filled('commercial_id') && Schema::hasColumn('sales', 'commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $searchableColumns = array_values(array_filter([
                Schema::hasColumn('sales', 'reference') ? 'reference' : null,
                Schema::hasColumn('sales', 'brand') ? 'brand' : null,
                Schema::hasColumn('sales', 'city') ? 'city' : null,
                Schema::hasColumn('sales', 'partner') ? 'partner' : null,
                Schema::hasColumn('sales', 'status') ? 'status' : null,
                Schema::hasColumn('sales', 'payment_status') ? 'payment_status' : null,
            ]));

            $query->where(function ($builder) use ($search, $searchableColumns) {
                foreach ($searchableColumns as $index => $column) {
                    if ($index === 0) {
                        $builder->where($column, 'like', "%{$search}%");
                    } else {
                        $builder->orWhere($column, 'like', "%{$search}%");
                    }
                }

                $builder->orWhereHas('linkedClient', function ($clientQuery) use ($search) {
                    $clientQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                });
            });
        }

        $dateColumn = $this->resolveDateColumn();

        if ($dateColumn !== 'id' && $request->filled('date_from')) {
            $query->whereDate($dateColumn, '>=', (string) $request->string('date_from'));
        }

        if ($dateColumn !== 'id' && $request->filled('date_to')) {
            $query->whereDate($dateColumn, '<=', (string) $request->string('date_to'));
        }

        $paginator = $query
            ->orderByDesc($dateColumn)
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 15));

        return response()->json([
            'data' => SaleResource::collection($paginator->getCollection())->resolve(),
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $sale = $this->saleService->create($request->validated());

        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items', 'payments'])
            ))->resolve(),
            201
        );
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items', 'payments'])
            ))->resolve()
        );
    }

    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $sale = $this->saleService->update($sale, $request->validated());

        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items', 'payments'])
            ))->resolve()
        );
    }

    public function destroy(Sale $sale): Response
    {
        $sale->delete();

        return response()->noContent();
    }

    public function filters(): JsonResponse
    {
        $commercialRole = Role::query()
            ->where('name', 'Commercial')
            ->where('guard_name', 'web')
            ->first();

        $commercials = $commercialRole
            ? User::query()
                ->select(['users.id', 'users.name'])
                ->join('model_has_roles', function ($join) use ($commercialRole) {
                    $join->on('model_has_roles.model_id', '=', 'users.id')
                        ->where('model_has_roles.model_type', User::class)
                        ->where('model_has_roles.role_id', $commercialRole->id);
                })
                ->orderBy('users.name')
                ->distinct()
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                ])
                ->values()
            : collect();

        return response()->json([
            'brands' => $this->distinctValues('brand'),
            'clients' => $this->distinctClientValues(),
            'cities' => $this->distinctValues('city'),
            'statuses' => $this->distinctValues('status'),
            'payment_statuses' => $this->distinctValues('payment_status'),
            'partners' => $this->distinctValues('partner'),
            'commercials' => $commercials,
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Sale::query();

        if ($request->filled('commercial_id') && Schema::hasColumn('sales', 'commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $searchableColumns = array_values(array_filter([
                Schema::hasColumn('sales', 'reference') ? 'reference' : null,
                Schema::hasColumn('sales', 'brand') ? 'brand' : null,
                Schema::hasColumn('sales', 'city') ? 'city' : null,
                Schema::hasColumn('sales', 'partner') ? 'partner' : null,
                Schema::hasColumn('sales', 'status') ? 'status' : null,
                Schema::hasColumn('sales', 'payment_status') ? 'payment_status' : null,
            ]));

            $query->where(function ($builder) use ($search, $searchableColumns) {
                foreach ($searchableColumns as $index => $column) {
                    if ($index === 0) {
                        $builder->where($column, 'like', "%{$search}%");
                    } else {
                        $builder->orWhere($column, 'like', "%{$search}%");
                    }
                }

                $builder->orWhereHas('linkedClient', function ($clientQuery) use ($search) {
                    $clientQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                });
            });
        }

        if ($request->filled('client')) {
            $client = trim((string) $request->string('client'));

            $query->whereHas('linkedClient', function ($clientQuery) use ($client) {
                $clientQuery->where('name', 'like', "%{$client}%");
            });
        }

        if ($request->filled('city') && Schema::hasColumn('sales', 'city')) {
            $query->where('city', (string) $request->string('city'));
        }

        if ($request->filled('status') && Schema::hasColumn('sales', 'status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status') && Schema::hasColumn('sales', 'payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('partner') && Schema::hasColumn('sales', 'partner')) {
            $query->where('partner', (string) $request->string('partner'));
        }

        $dateColumn = $this->resolveDateColumn();

        if ($dateColumn !== 'id' && $request->filled('date_from')) {
            $query->whereDate($dateColumn, '>=', (string) $request->string('date_from'));
        }

        if ($dateColumn !== 'id' && $request->filled('date_to')) {
            $query->whereDate($dateColumn, '<=', (string) $request->string('date_to'));
        }

        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();

        return response()->json([
            'tyres_today' => $dateColumn === 'id'
                ? 0
                : (int) (clone $query)->whereDate($dateColumn, $today)->sum('total_quantity'),
            'tyres_this_month' => $dateColumn === 'id'
                ? 0
                : (int) (clone $query)->whereBetween($dateColumn, [$monthStart, $monthEnd])->sum('total_quantity'),
            'tyres_en_cours' => (int) (clone $query)->where('status', 'EN COURS')->sum('total_quantity'),
            'sales_en_cours' => (int) (clone $query)->where('status', 'EN COURS')->count(),
            'total_unpaid' => round((float) (clone $query)->whereIn('payment_status', ['NON PAYE', 'NON PAYÉ'])->sum('total_sale'), 2),
        ]);
    }

    protected function distinctValues(string $column): array
    {
        if (! Schema::hasColumn('sales', $column)) {
            return [];
        }

        return Sale::query()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->values()
            ->all();
    }

    protected function distinctClientValues(): array
    {
        return Sale::query()
            ->whereNotNull('client_id')
            ->whereHas('linkedClient')
            ->with('linkedClient:id,name')
            ->get()
            ->pluck('linkedClient.name')
            ->filter(fn (?string $name) => $name !== null && trim($name) !== '')
            ->map(fn (string $name) => trim($name))
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    protected function resolveDateColumn(): string
    {
        if (Schema::hasColumn('sales', 'sale_date')) {
            return 'sale_date';
        }

        if (Schema::hasColumn('sales', 'date')) {
            return 'date';
        }

        if (Schema::hasColumn('sales', 'created_at')) {
            return 'created_at';
        }

        return 'id';
    }
}
