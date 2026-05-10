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
        return response()->json(
            (new ServiceOrderResource($serviceOrder->loadMissing(['commercial', 'items.product.service', 'payments', 'clientRecord'])))->resolve()
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
