<?php

namespace App\Http\Controllers;

use App\Domain\ServiceOrders\ServiceOrderService;
use App\Http\Resources\ServiceOrders\ServiceOrderResource;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceItemController extends Controller
{
    public function __construct(private ServiceOrderService $serviceOrderService) {}

    public function index(ServiceOrder $serviceOrder): JsonResponse
    {
        return response()->json($serviceOrder->items()->get());
    }

    public function destroy(ServiceOrder $serviceOrder, ServiceItem $serviceItem): JsonResponse
    {
        abort_unless($serviceItem->service_order_id === $serviceOrder->id, 404);
        abort_if($serviceOrder->items()->count() <= 1, 422, 'Une intervention doit avoir au moins une ligne.');

        $serviceItem->delete();

        return response()->json(null, 204);
    }

    public function sync(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_type' => ['required', 'in:service,part'],
            'items.*.service_type' => ['nullable', 'string', 'max:255'],
            'items.*.product_id' => ['nullable', Rule::exists('products', 'id')],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.parts_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ]);

        $userId = $request->user()?->id;

        $this->serviceOrderService->syncItems($serviceOrder, $validated['items'], $userId);

        return response()->json(
            (new ServiceOrderResource($serviceOrder->fresh()->load(['items.product', 'commercial', 'clientRecord'])))->resolve()
        );
    }
}
