<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;

class PurchaseController extends Controller
{
    /**
     * @var StockMovementService
     */
    private $movements;

    /**
     * @param StockMovementService $movements
     */
    public function __construct(StockMovementService $movements)
    {
        $this->movements = $movements;
    }

    public function index(Request $request)
    {
        $query = Purchase::with(['supplier', 'commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'creator', 'updater']);

        // Sorting
        $sortable = ['date', 'total_quantity', 'total_price', 'payment_status', 'status', 'created_at', 'updated_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest();
        }

        // Text search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('supplier', function ($q2) use ($search) {
                      $q2->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('commercial', function ($q2) use ($search) {
                      $q2->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('items.linkedProduct', function ($q2) use ($search) {
                      $q2->where('profile', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhereHas('brand', function ($q3) use ($search) {
                            $q3->where('name', 'like', "%{$search}%");
                        });
                  });
            });
        }

        // Exact field filters
        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }
        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->commercial_id);
        }

        // Date range
        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        return $query->paginate($request->get('per_page', 20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => 'required|string|in:EN COURS,RECU,ANNULE,RETOUR',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->rejectServicePurchases($request->items)) {
            return $error;
        }

        $purchaseData = $request->except('items');
        $itemsData = $request->items;
        $userId = $request->user()->id;

        $purchase = \Illuminate\Support\Facades\DB::transaction(function () use ($purchaseData, $itemsData, $userId) {
            $totalQuantity = 0;
            $totalPrice = 0;

            foreach ($itemsData as $itemData) {
                $q = $itemData['quantity'] ?? 1;
                $up = floatval($itemData['unit_price'] ?? 0);
                $totalQuantity += $q;
                $totalPrice += ($up * $q);
            }

            $purchase = Purchase::create(array_merge($purchaseData, [
                'total_quantity' => $totalQuantity,
                'total_price' => $totalPrice,
                'created_by' => $userId,
            ]));

            foreach ($itemsData as $itemData) {
                $q = $itemData['quantity'] ?? 1;
                $up = floatval($itemData['unit_price'] ?? 0);

                $purchase->items()->create([
                    'product_id' => $itemData['product_id'],
                    'stock_id' => $itemData['stock_id'],
                    'quantity' => $q,
                    'unit_price' => $up,
                ]);

                // Increase stock quantity
                $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
                $before = (int) $stock->quantity;
                $stock->quantity = $before + $q;
                $stock->save();
                $this->movements->recordPurchaseIn(
                    $stock->id,
                    $stock->product_id,
                    $before,
                    (int) $stock->quantity,
                    $purchase->id,
                    $userId
                );
            }

            return $purchase;
        });

        return response()->json($purchase->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'supplier', 'commercial']), 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return response()->json($purchase->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'supplier', 'commercial']));
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'with_invoice' => 'boolean',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'required|exists:users,id',
            'status' => 'required|string|in:EN COURS,RECU,ANNULE,RETOUR',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.stock_id' => 'required|exists:stocks,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($error = $this->rejectServicePurchases($request->items)) {
            return $error;
        }

        $oldStatus = $purchase->status;
        $itemsData = $request->items;
        $userId = $request->user()->id;

        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $purchase, $itemsData, $oldStatus, $userId) {
            // Revert stock for existing items if they weren't cancelled/returned previously
            if (!in_array($oldStatus, ['ANNULE', 'RETOUR'])) {
                foreach ($purchase->items as $existingItem) {
                    if ($existingItem->stock_id) {
                        $stock = Stock::lockForUpdate()->find($existingItem->stock_id);
                        if ($stock) {
                            $before = (int) $stock->quantity;
                            $stock->quantity = $before - (int) $existingItem->quantity;
                            $stock->save();
                            $this->movements->recordPurchaseOut(
                                $stock->id,
                                $stock->product_id,
                                $before,
                                (int) $stock->quantity,
                                $purchase->id,
                                $userId
                            );
                        }
                    }
                }
            }

            // Delete old items
            $purchase->items()->delete();

            $totalQuantity = 0;
            $totalPrice = 0;

            foreach ($itemsData as $itemData) {
                $q = $itemData['quantity'] ?? 1;
                $up = floatval($itemData['unit_price'] ?? 0);
                $totalQuantity += $q;
                $totalPrice += ($up * $q);
            }

            $purchaseData = array_merge(
                $request->except('items'),
                [
                    'total_quantity' => $totalQuantity,
                    'total_price' => $totalPrice,
                    'updated_by' => $userId,
                ]
            );

            $purchase->update($purchaseData);
            $newStatus = $request->input('status', $oldStatus);

            foreach ($itemsData as $itemData) {
                $q = $itemData['quantity'] ?? 1;
                $up = floatval($itemData['unit_price'] ?? 0);

                $purchase->items()->create([
                    'product_id' => $itemData['product_id'],
                    'stock_id' => $itemData['stock_id'],
                    'quantity' => $q,
                    'unit_price' => $up,
                ]);

                // Increase stock quantity unless cancelled/returned
                if (!in_array($newStatus, ['ANNULE', 'RETOUR'])) {
                    $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
                    $before = (int) $stock->quantity;
                    $stock->quantity = $before + $q;
                    $stock->save();
                    $this->movements->recordPurchaseIn(
                        $stock->id,
                        $stock->product_id,
                        $before,
                        (int) $stock->quantity,
                        $purchase->id,
                        $userId
                    );
                }
            }
        });

        return response()->json($purchase->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'supplier', 'commercial']));
    }

    public function destroy(Request $request, Purchase $purchase): JsonResponse
    {
        $userId = $request->user() ? $request->user()->id : null;

        \Illuminate\Support\Facades\DB::transaction(function () use ($purchase, $userId) {
            // Remove from stock (unless already cancelled/returned, which already decremented stock)
            if (!in_array($purchase->status, ['ANNULE', 'RETOUR'])) {
                foreach ($purchase->items as $item) {
                    if ($item->stock_id) {
                        $stock = Stock::lockForUpdate()->find($item->stock_id);
                        if ($stock) {
                            $before = (int) $stock->quantity;
                            $stock->quantity = $before - (int) $item->quantity;
                            $stock->save();
                            $this->movements->recordPurchaseOut(
                                $stock->id,
                                $stock->product_id,
                                $before,
                                (int) $stock->quantity,
                                $purchase->id,
                                $userId
                            );
                        }
                    }
                }
            }

            // Delete linked transactions and payments
            $transactionIds = $purchase->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $purchase->payments()->delete();
            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $purchase->delete();
        });

        return response()->json(null, 204);
    }

    public function summary(Request $request): JsonResponse
    {
        $query = Purchase::query();

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }
        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->commercial_id);
        }
        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        $totalAchats = (clone $query)->sum('total_price') ?? 0;
        $totalPaye = (clone $query)->where('payment_status', 'PAYE')->sum('total_price') ?? 0;
        $resteAPayer = $totalAchats - $totalPaye;

        return response()->json([
            'total_achats' => round($totalAchats, 2),
            'total_paye' => round($totalPaye, 2),
            'reste_a_payer' => round($resteAPayer, 2),
        ]);
    }

    public function filters(): JsonResponse
    {
        return response()->json([
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name']),
            'commercials' => User::role(['Commercial', 'Manager', 'Administrator'])->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Services cannot be purchased — they represent labor, not inventory.
     * Returns a 422 JsonResponse if any item references a service product, otherwise null.
     *
     * @param array $items
     * @return \Illuminate\Http\JsonResponse|null
     */
    private function rejectServicePurchases(array $items): ?JsonResponse
    {
        $productIds = collect($items)->pluck('product_id')->filter()->unique()->values();
        $serviceIds = \App\Models\Product::whereIn('id', $productIds)
            ->where('type', 'service')
            ->pluck('id');

        if ($serviceIds->isEmpty()) {
            return null;
        }

        $errors = [];
        foreach ($items as $i => $item) {
            if ($serviceIds->contains($item['product_id'] ?? null)) {
                $errors["items.{$i}.product_id"] = ['Les services ne peuvent pas être achetés.'];
            }
        }

        return response()->json([
            'message' => 'Les services ne peuvent pas figurer dans un achat.',
            'errors' => $errors,
        ], 422);
    }
}