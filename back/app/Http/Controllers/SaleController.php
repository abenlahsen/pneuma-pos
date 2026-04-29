<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SaleService;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Carrier;
use App\Models\Partner;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;

class SaleController extends Controller
{
    public function __construct(
        protected SaleService $saleService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()
            ->with(['linkedClient', 'commercial', 'linkedCarrier', 'linkedPartner', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);

        if ($request->filled('commercial_id') && Schema::hasColumn('sales', 'commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('carrier_id')) {
            $query->where('carrier_id', $request->integer('carrier_id'));
        }

        if ($request->filled('partner_id')) {
            $query->where('partner_id', $request->integer('partner_id'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($builder) use ($search) {
                $builder->orWhereHas('linkedClient', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                })
                ->orWhereHas('commercial', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                })
                ->orWhereHas('items.linkedProduct', function ($q) use ($search) {
                    $q->where('profile', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhereHas('brand', function ($q2) use ($search) {
                            $q2->where('name', 'like', "%{$search}%");
                        });
                });

                foreach (['reference', 'brand', 'city', 'status', 'payment_status'] as $column) {
                    if (Schema::hasColumn('sales', $column)) {
                        $builder->orWhere($column, 'like', "%{$search}%");
                    }
                }
            });
        }

        if ($request->filled('client')) {
            $client = trim((string) $request->string('client'));
            $query->whereHas('linkedClient', function ($q) use ($client) {
                $q->where('name', 'like', "%{$client}%");
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

        if ($request->filled('brand') && Schema::hasColumn('sales', 'brand')) {
            $query->where('brand', (string) $request->string('brand'));
        }

        $dateColumn = $this->resolveDateColumn();

        if ($dateColumn !== 'id' && $request->filled('date_from')) {
            $query->whereDate($dateColumn, '>=', (string) $request->string('date_from'));
        }

        if ($dateColumn !== 'id' && $request->filled('date_to')) {
            $query->whereDate($dateColumn, '<=', (string) $request->string('date_to'));
        }

        $sortable = ['date', 'total_quantity', 'total_sale', 'margin', 'payment_status', 'status', 'client', 'created_at', 'updated_at'];
        if ($request->filled('sort_by') && in_array($request->string('sort_by')->toString(), $sortable, true)) {
            $direction = $request->string('sort_direction')->toString() === 'desc' ? 'desc' : 'asc';
            $query->orderBy((string) $request->string('sort_by'), $direction)->orderByDesc('id');
        } else {
            $query->orderByDesc($dateColumn)->orderByDesc('id');
        }

        $paginator = $query->paginate((int) $request->integer('per_page', 15));

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
        $sale = $this->saleService->create($request->validated(), $request->user()?->id);

        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve(),
            201
        );
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve()
        );
    }

    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $sale = $this->saleService->update($sale, $request->validated(), $request->user()?->id);

        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve()
        );
    }

    public function destroy(Sale $sale, Request $request): Response
    {
        $this->saleService->delete($sale, $request->user()?->id);

        return response()->noContent();
    }

    public function filters(): JsonResponse
    {
        $commercials = User::role(['Commercial', 'Manager', 'Administrator'])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        $usedCarrierIds = Sale::query()->whereNotNull('carrier_id')->distinct()->pluck('carrier_id');
        $carriers = Carrier::query()
            ->whereIn('id', $usedCarrierIds)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        $usedPartnerIds = Sale::query()->whereNotNull('partner_id')->distinct()->pluck('partner_id');
        $partners = Partner::query()
            ->whereIn('id', $usedPartnerIds)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        return response()->json([
            'brands' => $this->distinctValues('brand'),
            'clients' => $this->distinctClientValues(),
            'cities' => $this->distinctValues('city'),
            'statuses' => $this->distinctValues('status'),
            'payment_statuses' => $this->distinctValues('payment_status'),
            'carriers' => $carriers,
            'partners' => $partners,
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
            $query->where(function ($builder) use ($search) {
                $builder->orWhereHas('linkedClient', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                })
                ->orWhereHas('commercial', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%");
                })
                ->orWhereHas('items.linkedProduct', function ($q) use ($search) {
                    $q->where('profile', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhereHas('brand', function ($q2) use ($search) {
                            $q2->where('name', 'like', "%{$search}%");
                        });
                });

                foreach (['reference', 'brand', 'city', 'status', 'payment_status'] as $column) {
                    if (Schema::hasColumn('sales', $column)) {
                        $builder->orWhere($column, 'like', "%{$search}%");
                    }
                }
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

        if ($request->filled('carrier_id')) {
            $query->where('carrier_id', $request->integer('carrier_id'));
        }

        if ($request->filled('partner_id')) {
            $query->where('partner_id', $request->integer('partner_id'));
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
