<?php

namespace App\Http\Controllers;

use App\Domain\Sales\SaleService;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Carrier;
use App\Models\City;
use App\Models\Partner;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SaleController extends Controller
{
    public function __construct(
        protected SaleService $saleService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()
            ->with(['linkedClient.cityRelation', 'commercial', 'linkedCarrier', 'linkedPartner', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments']);

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
                        ->orWhereHas('cityRelation', fn ($q2) => $q2->where('name', 'like', "%{$search}%"));
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

                foreach (['reference', 'brand', 'status', 'payment_status'] as $column) {
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

        if ($request->filled('city')) {
            $cityId = City::where('name', (string) $request->string('city'))->value('id');
            if ($cityId) {
                $query->whereHas('linkedClient', fn ($q) => $q->where('city_id', $cityId));
            }
        }

        if ($request->filled('status') && Schema::hasColumn('sales', 'status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status') && Schema::hasColumn('sales', 'payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('payment_method') && Schema::hasColumn('sales', 'payment_method')) {
            $query->where('payment_method', (string) $request->string('payment_method'));
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

        if ($request->filled('with_invoice') && Schema::hasColumn('sales', 'with_invoice')) {
            $query->where('with_invoice', filter_var($request->input('with_invoice'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('amount_min') && Schema::hasColumn('sales', 'total_sale')) {
            $query->where('total_sale', '>=', (float) $request->input('amount_min'));
        }

        if ($request->filled('amount_max') && Schema::hasColumn('sales', 'total_sale')) {
            $query->where('total_sale', '<=', (float) $request->input('amount_max'));
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
                $sale->loadMissing(['linkedClient.cityRelation', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve(),
            201
        );
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient.cityRelation', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve()
        );
    }

    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        if ($sale->status === 'TERMINEE' && ! $request->user()->hasRole('Administrator')) {
            return response()->json(['message' => 'Cette vente est terminée et ne peut plus être modifiée.'], 403);
        }

        $sale = $this->saleService->update($sale, $request->validated(), $request->user()?->id);

        return response()->json(
            (new SaleResource(
                $sale->loadMissing(['linkedClient.cityRelation', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'payments'])
            ))->resolve()
        );
    }

    public function destroy(Sale $sale, Request $request): Response
    {
        if ($sale->status === 'TERMINEE' && ! $request->user()->hasRole('Administrator')) {
            return response()->json(['message' => 'Cette vente est terminée et ne peut plus être supprimée.'], 403);
        }

        $this->saleService->delete($sale, $request->user()?->id);

        return response()->noContent();
    }

    public function export(Request $request): StreamedResponse
    {
        $query = Sale::query()
            ->with(['linkedClient', 'commercial', 'linkedCarrier', 'linkedPartner', 'items.linkedProduct.brand', 'items.linkedProduct.tyre']);

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
                        ->orWhereHas('cityRelation', fn ($q2) => $q2->where('name', 'like', "%{$search}%"));
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

                foreach (['reference', 'brand', 'status', 'payment_status'] as $column) {
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

        if ($request->filled('city')) {
            $cityId = City::where('name', (string) $request->string('city'))->value('id');
            if ($cityId) {
                $query->whereHas('linkedClient', fn ($q) => $q->where('city_id', $cityId));
            }
        }

        if ($request->filled('status') && Schema::hasColumn('sales', 'status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status') && Schema::hasColumn('sales', 'payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('payment_method') && Schema::hasColumn('sales', 'payment_method')) {
            $query->where('payment_method', (string) $request->string('payment_method'));
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

        if ($request->filled('with_invoice') && Schema::hasColumn('sales', 'with_invoice')) {
            $query->where('with_invoice', filter_var($request->input('with_invoice'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('amount_min') && Schema::hasColumn('sales', 'total_sale')) {
            $query->where('total_sale', '>=', (float) $request->input('amount_min'));
        }

        if ($request->filled('amount_max') && Schema::hasColumn('sales', 'total_sale')) {
            $query->where('total_sale', '<=', (float) $request->input('amount_max'));
        }

        $query->orderByDesc($dateColumn)->orderByDesc('id');

        $fileName = 'ventes-'.now()->format('Y-m-d-His').'.xlsx';
        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
            'Cache-Control' => 'max-age=0, no-store, no-cache, must-revalidate',
            'Pragma' => 'public',
        ];

        return response()->streamDownload(function () use ($query) {
            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Ventes');

            $rows = [[
                'Date',
                'Référence',
                'Client',
                'Téléphone',
                'Ville',
                'Commercial',
                'Transporteur',
                'Partenaire',
                'Statut',
                'Paiement',
                'Facture',
                'Méthode paiement',
                'Qté totale',
                'Total achat',
                'Total vente',
                'Marge',
            ]];

            $query->get()->each(function (Sale $sale) use (&$rows) {
                $date = $sale->sale_date ?? $sale->date;
                $rows[] = [
                    $date ? (is_string($date) ? $date : $date->format('Y-m-d')) : '',
                    $sale->reference ?? '',
                    $sale->linkedClient?->name ?? $sale->client ?? '',
                    $sale->linkedClient?->phone ?? $sale->client_phone ?? '',
                    $sale->linkedClient?->city ?? '',
                    $sale->commercial?->name ?? '',
                    $sale->linkedCarrier?->name ?? '',
                    $sale->linkedPartner?->name ?? $sale->partner ?? '',
                    $sale->status ?? '',
                    $sale->payment_status ?? '',
                    $sale->with_invoice ? 'Oui' : 'Non',
                    $sale->payment_method ?? '',
                    (int) ($sale->total_quantity ?? 0),
                    $sale->total_purchase !== null ? round((float) $sale->total_purchase, 2) : null,
                    $sale->total_sale !== null ? round((float) $sale->total_sale, 2) : null,
                    $sale->margin !== null ? round((float) $sale->margin, 2) : null,
                ];
            });

            $sheet->fromArray($rows, null, 'A1', true);
            $sheet->getStyle('A1:P1')->getFont()->setBold(true);
            $sheet->freezePane('A2');

            foreach (range('A', 'P') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $fileName, $headers);
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
            'cities' => $this->distinctClientCities(),
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
                        ->orWhereHas('cityRelation', fn ($q2) => $q2->where('name', 'like', "%{$search}%"));
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

                foreach (['reference', 'brand', 'status', 'payment_status'] as $column) {
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

        if ($request->filled('city')) {
            $cityId = City::where('name', (string) $request->string('city'))->value('id');
            if ($cityId) {
                $query->whereHas('linkedClient', fn ($q) => $q->where('city_id', $cityId));
            }
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

        $tyreSaleQty = function ($saleSubQuery): int {
            return (int) DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->where('products.type', 'tyre')
                ->whereIn('sale_items.sale_id', $saleSubQuery->select('id'))
                ->sum('sale_items.quantity');
        };

        return response()->json([
            'tyres_today' => $dateColumn === 'id'
                ? 0
                : $tyreSaleQty((clone $query)->whereDate($dateColumn, $today)),
            'tyres_this_month' => $dateColumn === 'id'
                ? 0
                : $tyreSaleQty((clone $query)->whereDate($dateColumn, '>=', $monthStart)->whereDate($dateColumn, '<=', $monthEnd)),
            'tyres_en_cours' => $tyreSaleQty((clone $query)->where('status', 'EN COURS')),
            'sales_en_cours' => (int) (clone $query)->where('status', 'EN COURS')->count(),
            'unpaid_en_cours' => (function () use ($query): float {
                $q = (clone $query)
                    ->where('status', 'EN COURS')
                    ->whereIn('payment_status', ['NON PAYE', 'NON PAYÉ', 'PARTIEL']);
                $totalSale = (float) (clone $q)->sum('total_sale');
                $totalPaid = (float) DB::table('payments')
                    ->whereIn('sale_id', (clone $q)->select('id'))
                    ->sum('amount');
                return round($totalSale - $totalPaid, 2);
            })(),
            'unpaid_livre_monte' => (function () use ($query): float {
                $q = (clone $query)
                    ->whereIn('status', ['LIVRE', 'MONTE'])
                    ->whereIn('payment_status', ['NON PAYE', 'NON PAYÉ', 'PARTIEL']);
                $totalSale = (float) (clone $q)->sum('total_sale');
                $totalPaid = (float) DB::table('payments')
                    ->whereIn('sale_id', (clone $q)->select('id'))
                    ->sum('amount');
                return round($totalSale - $totalPaid, 2);
            })(),
            'ca_avec_facture'   => round((float) (clone $query)->where('with_invoice', true)->sum('total_sale'), 2),
            'ca_sans_facture'   => round((float) (clone $query)->where('with_invoice', false)->sum('total_sale'), 2),
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

    protected function distinctClientCities(): array
    {
        return Sale::query()
            ->whereNotNull('client_id')
            ->whereHas('linkedClient', fn ($q) => $q->whereNotNull('city_id'))
            ->with('linkedClient:id,city_id', 'linkedClient.cityRelation:id,name')
            ->get()
            ->pluck('linkedClient.city')
            ->filter(fn ($c) => $c !== null && trim((string) $c) !== '')
            ->map(fn ($c) => trim((string) $c))
            ->unique()
            ->sort()
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
