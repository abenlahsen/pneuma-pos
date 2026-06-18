<?php

namespace App\Http\Controllers;

use App\Domain\ServiceOrders\ServiceOrderService;
use App\Http\Requests\ServiceOrders\StoreServiceOrderRequest;
use App\Http\Requests\ServiceOrders\UpdateServiceOrderRequest;
use App\Http\Resources\ServiceOrders\ServiceOrderResource;
use App\Models\Account;
use App\Models\Client;
use App\Models\Product;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ServiceOrderController extends Controller
{
    public function __construct(protected ServiceOrderService $serviceOrderService) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceOrder::query()->with(['commercial', 'items.product', 'clientRecord']);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('product_id')) {
            $query->whereHas('items', fn ($q) => $q->where('product_id', $request->integer('product_id')));
        }

        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', (string) $request->string('date_to'));
        }

        $query->orderByDesc('date')->orderByDesc('id');

        $paginator = $query->paginate((int) $request->integer('per_page', 20));

        return response()->json([
            'data' => ServiceOrderResource::collection($paginator->getCollection())->resolve(),
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    public function store(StoreServiceOrderRequest $request): JsonResponse
    {
        $order = $this->serviceOrderService->create($request->validated(), $request->user()?->id);

        return response()->json(
            (new ServiceOrderResource($order))->resolve(),
            201
        );
    }

    public function show(ServiceOrder $serviceOrder): JsonResponse
    {
        $serviceOrder->load([
            'commercial',
            'items.product' => fn ($q) => $q->with('service')->withSum('stocks', 'quantity'),
            'payments',
            'clientRecord',
            'vehicle',
        ]);

        return response()->json(
            (new ServiceOrderResource($serviceOrder))->resolve()
        );
    }

    public function update(UpdateServiceOrderRequest $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $order = $this->serviceOrderService->update($serviceOrder, $request->validated(), $request->user()?->id);

        return response()->json(
            (new ServiceOrderResource($order))->resolve()
        );
    }

    public function destroy(Request $request, ServiceOrder $serviceOrder): Response
    {
        $this->serviceOrderService->delete($serviceOrder, $request->user()?->id);

        return response()->noContent();
    }

    public function summary(Request $request): JsonResponse
    {
        $query = ServiceOrder::query();

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('product_id')) {
            $query->whereHas('items', fn ($q) => $q->where('product_id', $request->integer('product_id')));
        }

        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', (string) $request->string('date_to'));
        }

        $totalRevenue = round((float) (clone $query)->sum('net_amount'), 2);
        $totalPaid = round(
            (float) (clone $query)->withSum('payments', 'amount')->get()->sum('payments_sum_amount'),
            2
        );

        return response()->json([
            'total_revenue' => $totalRevenue,
            'total_paid' => $totalPaid,
            'remaining' => round($totalRevenue - $totalPaid, 2),
        ]);
    }

    public function searchParts(Request $request): JsonResponse
    {
        $search = (string) ($request->string('q') ?? '');

        $query = Product::query()
            ->where('type', 'part')
            ->where('is_active', true)
            ->with(['part', 'stocks' => fn ($q) => $q->select('id', 'product_id', 'quantity', 'purchase_price')])
            ->withSum('stocks', 'quantity');

        if (strlen($search) >= 2) {
            $query->where(function ($q) use ($search) {
                $q->where('profile', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('part', fn ($p) => $p->where('oem_reference', 'like', "%{$search}%"));
            });
        }

        $products = $query->orderBy('profile')->limit(20)->get();

        return response()->json($products->map(fn ($p) => [
            'id' => $p->id,
            'name' => $p->profile,
            'reference' => $p->reference,
            'oem_reference' => $p->part?->oem_reference,
            'description' => $p->description,
            'unit' => $p->unit ?? 'pièce',
            'total_quantity' => (int) $p->stocks_sum_quantity,
            'stock_id' => $p->stocks->first()?->id,
            'purchase_price' => (float) ($p->stocks->first()?->purchase_price ?? 0),
        ]));
    }

    public function export(Request $request): StreamedResponse
    {
        $query = ServiceOrder::query()
            ->with(['clientRecord', 'commercial', 'vehicle'])
            ->withSum('payments', 'amount');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('product_id')) {
            $query->whereHas('items', fn ($q) => $q->where('product_id', $request->integer('product_id')));
        }

        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', (string) $request->string('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', (string) $request->string('date_to'));
        }

        $query->orderByDesc('date')->orderByDesc('id');

        $fileName = 'service-auto-'.now()->format('Y-m-d-His').'.xlsx';
        $headers = [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
            'Cache-Control' => 'max-age=0, no-store, no-cache, must-revalidate',
            'Pragma' => 'public',
        ];

        return response()->streamDownload(function () use ($query) {
            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Service Auto');

            $rows = [[
                'Date',
                'Client',
                'Téléphone',
                'Véhicule',
                'Kilométrage',
                'Commercial',
                'Statut',
                'Paiement',
                'Remise (%)',
                'Total brut',
                'Net',
                'Payé',
                'Reste',
            ]];

            $query->get()->each(function (ServiceOrder $order) use (&$rows) {
                $net    = round((float) ($order->net_amount ?? 0), 2);
                $paid   = round((float) ($order->payments_sum_amount ?? 0), 2);
                $reste  = max(0, round($net - $paid, 2));

                $vehicle = $order->vehicle
                    ? $order->vehicle->display_name
                    : ($order->vehicle ?? '');

                $rows[] = [
                    $order->date?->format('Y-m-d') ?? '',
                    $order->clientRecord?->name ?? '',
                    $order->clientRecord?->phone ?? '',
                    $vehicle,
                    $order->mileage ?? '',
                    $order->commercial?->name ?? '',
                    $order->status ?? '',
                    $order->payment_status ?? '',
                    round((float) ($order->discount ?? 0), 2),
                    round((float) ($order->total_amount ?? 0), 2),
                    $net,
                    $paid,
                    $reste,
                ];
            });

            $sheet->fromArray($rows, null, 'A1', true);
            $sheet->getStyle('A1:M1')->getFont()->setBold(true);
            $sheet->freezePane('A2');

            foreach (range('A', 'M') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $fileName, $headers);
    }

    public function filters(): JsonResponse
    {
        $serviceProducts = Product::where('type', 'service')
            ->where('is_active', true)
            ->orderBy('profile')
            ->get(['id', 'profile', 'reference'])
            ->values();

        $commercials = User::role(['Commercial', 'Manager', 'Administrator'])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        $clients = Client::active()
            ->orderBy('name')
            ->get(['id', 'name', 'phone'])
            ->values();

        $accounts = Account::active()
            ->orderBy('name')
            ->get(['id', 'name', 'type'])
            ->values();

        return response()->json([
            'service_products' => $serviceProducts,
            'commercials' => $commercials,
            'clients' => $clients,
            'accounts' => $accounts,
        ]);
    }
}
