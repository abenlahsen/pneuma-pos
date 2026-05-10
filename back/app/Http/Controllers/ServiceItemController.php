<?php

namespace App\Http\Controllers;

use App\Http\Resources\ServiceOrders\ServiceOrderResource;
use App\Models\ServiceItem;
use App\Models\ServiceOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceItemController extends Controller
{
    public function index(ServiceOrder $serviceOrder): JsonResponse
    {
        return response()->json($serviceOrder->items()->get());
    }

    public function store(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('type', 'service')],
            'description' => ['nullable', 'string', 'max:2000'],
            'parts_cost' => ['required', 'numeric', 'min:0'],
            'labor_cost' => ['required', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $item = $serviceOrder->items()->create($validated);

        return response()->json($item, 201);
    }

    public function update(Request $request, ServiceOrder $serviceOrder, ServiceItem $serviceItem): JsonResponse
    {
        abort_unless($serviceItem->service_order_id === $serviceOrder->id, 404);

        $validated = $request->validate([
            'product_id' => ['sometimes', 'required', 'integer', Rule::exists('products', 'id')->where('type', 'service')],
            'description' => ['nullable', 'string', 'max:2000'],
            'parts_cost' => ['sometimes', 'required', 'numeric', 'min:0'],
            'labor_cost' => ['sometimes', 'required', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $serviceItem->update($validated);

        return response()->json($serviceItem->fresh());
    }

    public function destroy(ServiceOrder $serviceOrder, ServiceItem $serviceItem): JsonResponse
    {
        abort_unless($serviceItem->service_order_id === $serviceOrder->id, 404);
        abort_if($serviceOrder->items()->count() <= 1, 422, 'Une intervention doit avoir au moins une prestation.');

        $serviceItem->delete();

        return response()->json(null, 204);
    }

    public function sync(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('type', 'service')],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.parts_cost' => ['required', 'numeric', 'min:0'],
            'items.*.labor_cost' => ['required', 'numeric', 'min:0'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ]);

        ServiceItem::withoutEvents(function () use ($serviceOrder, $validated) {
            $serviceOrder->items()->delete();
            foreach ($validated['items'] as $i => $itemData) {
                $parts = (float) $itemData['parts_cost'];
                $labor = (float) $itemData['labor_cost'];
                $serviceOrder->items()->create([
                    'product_id' => $itemData['product_id'],
                    'description' => $itemData['description'] ?? null,
                    'parts_cost' => $parts,
                    'labor_cost' => $labor,
                    'line_total' => $parts + $labor,
                    'sort_order' => $itemData['sort_order'] ?? $i,
                ]);
            }
        });

        $serviceOrder->recalculateTotals();

        return response()->json(
            (new ServiceOrderResource($serviceOrder->fresh()->load(['items', 'commercial'])))->resolve()
        );
    }
}
