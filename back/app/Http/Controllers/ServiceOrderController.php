<?php

namespace App\Http\Controllers;

use App\Domain\ServiceOrders\ServiceOrderService;
use App\Http\Requests\ServiceOrders\StoreServiceOrderRequest;
use App\Http\Requests\ServiceOrders\UpdateServiceOrderRequest;
use App\Http\Resources\ServiceOrders\ServiceOrderResource;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ServiceOrderController extends Controller
{
    public function __construct(protected ServiceOrderService $serviceOrderService) {}

    public function index(Request $request): JsonResponse
    {
        $query = ServiceOrder::query()->with(['commercial', 'items']);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', (string) $request->string('payment_status'));
        }

        if ($request->filled('service_type')) {
            $type = (string) $request->string('service_type');
            $query->whereHas('items', fn ($q) => $q->where('service_type', $type));
        }

        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('client')) {
            $client = trim((string) $request->string('client'));
            $query->where('client', 'like', "%{$client}%");
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
        return response()->json(
            (new ServiceOrderResource($serviceOrder->loadMissing(['commercial', 'items', 'payments'])))->resolve()
        );
    }

    public function update(UpdateServiceOrderRequest $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $order = $this->serviceOrderService->update($serviceOrder, $request->validated(), $request->user()?->id);

        return response()->json(
            (new ServiceOrderResource($order))->resolve()
        );
    }

    public function destroy(ServiceOrder $serviceOrder): Response
    {
        $this->serviceOrderService->delete($serviceOrder);

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

        if ($request->filled('service_type')) {
            $type = (string) $request->string('service_type');
            $query->whereHas('items', fn ($q) => $q->where('service_type', $type));
        }

        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->integer('commercial_id'));
        }

        if ($request->filled('client')) {
            $client = trim((string) $request->string('client'));
            $query->where('client', 'like', "%{$client}%");
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

    public function filters(): JsonResponse
    {
        $serviceTypes = ServiceItem::query()
            ->whereNotNull('service_type')
            ->where('service_type', '!=', '')
            ->distinct()
            ->orderBy('service_type')
            ->pluck('service_type')
            ->values()
            ->all();

        $commercials = User::role(['Commercial', 'Manager', 'Administrator'])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->values();

        return response()->json([
            'service_types' => $serviceTypes,
            'commercials' => $commercials,
        ]);
    }
}
