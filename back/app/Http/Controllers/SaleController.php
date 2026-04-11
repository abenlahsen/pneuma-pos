<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\User;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private readonly StockMovementService $movements)
    {
    }

    /**
     * Display a paginated list of sales with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()->with(['commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'items.stock', 'creator', 'updater']);

        // Sorting
        $sortable = ['date', 'client', 'total_quantity', 'total_sale', 'margin', 'payment_status', 'status', 'created_at', 'updated_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest('id');
        }

        // Filter by text search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('client', 'like', "%{$search}%")
                  ->orWhere('comments', 'like', "%{$search}%")
                  ->orWhereHas('items.linkedProduct', function ($q2) use ($search) {
                      $q2->where('profile', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhereHas('brand', function ($q3) use ($search) {
                            $q3->where('name', 'like', "%{$search}%");
                        });
                  });
            });
        }

        // Filter by brand (via linked product)
        if ($request->filled('brand')) {
            $query->whereHas('items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', function ($q) use ($request) {
                $q->where('name', $request->brand);
            });
        }

        // Filter by exact fields
        $fields = ['city', 'payment_method', 'status', 'payment_status'];
        foreach ($fields as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->$field);
            }
        }

        // Filter by client (partial match)
        if ($request->filled('client')) {
            $query->where('client', 'like', '%' . $request->client . '%');
        }

        // Filter by commercial
        if ($request->filled('commercial_id')) {
            $query->where('commercial_id', $request->commercial_id);
        }

        // Filter by partner relationship
        if ($request->filled('partner')) {
            $query->whereHas('partner', function($q) use ($request) {
                $q->where('name', $request->partner);
            });
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        $sales = $query->paginate($request->get('per_page', 20));

        return response()->json($sales);
    }

    /**
     * Store a newly created sale.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        // 1. Validate all stocks first (only for items that track stock)
        $itemsData = $request->items;
        foreach ($itemsData as $itemIndex => $itemData) {
            if (empty($itemData['stock_id'])) {
                // Service lines (or stockless items) — skip stock validation
                continue;
            }
            $stock = Stock::find($itemData['stock_id']);
            if (!$stock || $stock->quantity < ($itemData['quantity'] ?? 1)) {
                return response()->json([
                    'message' => 'Quantité insuffisante en stock.',
                    'errors' => ["items.{$itemIndex}.stock_id" => ['Quantité insuffisante en stock. Disponible: ' . ($stock->quantity ?? 0)]],
                ], 422);
            }
        }

        $userId = $request->user()->id;

        $sale = \Illuminate\Support\Facades\DB::transaction(function () use ($request, $itemsData, $userId) {
            // Recalculate totals
            $totalQuantity = 0;
            $totalPurchase = 0;
            $totalSale = 0;

            foreach ($itemsData as $itemData) {
                $qte = $itemData['quantity'] ?? 1;
                $purchP = floatval($itemData['purchase_price'] ?? 0);
                $sellP = floatval($itemData['selling_price'] ?? 0);

                $totalQuantity += $qte;
                $totalPurchase += ($purchP * $qte);
                $totalSale += ($sellP * $qte);
            }

            $margin = $totalSale - $totalPurchase;

            $saleData = array_merge(
                $request->except('items'),
                [
                    'total_quantity' => $totalQuantity,
                    'total_purchase' => $totalPurchase,
                    'total_sale' => $totalSale,
                    'margin' => $margin,
                    'created_by' => $userId,
                ]
            );

            $sale = Sale::create($saleData);

            // Create items and decrease stock
            foreach ($itemsData as $itemData) {
                $qte = $itemData['quantity'] ?? 1;
                $purchP = floatval($itemData['purchase_price'] ?? 0);
                $sellP = floatval($itemData['selling_price'] ?? 0);

                $sale->items()->create([
                    'product_id' => $itemData['product_id'],
                    'stock_id' => $itemData['stock_id'] ?? null,
                    'quantity' => $qte,
                    'purchase_price' => $purchP,
                    'selling_price' => $sellP,
                    'total_purchase' => $purchP * $qte,
                    'total_sale' => $sellP * $qte,
                    'margin' => ($sellP * $qte) - ($purchP * $qte),
                ]);

                // Skip stock decrement for stockless items (services)
                if (empty($itemData['stock_id'])) {
                    continue;
                }

                $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
                $before = (int) $stock->quantity;
                $stock->quantity = $before - $qte;
                $stock->save();
                $this->movements->recordSaleOut(
                    $stock->id,
                    $stock->product_id,
                    $before,
                    (int) $stock->quantity,
                    $sale->id,
                    $userId
                );
            }

            return $sale;
        });

        return response()->json($sale->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'items.stock']), 201);
    }

    /**
     * Display the specified sale.
     */
    public function show(Sale $sale): JsonResponse
    {
        return response()->json($sale->load(['commercial', 'items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'items.stock', 'creator', 'updater']));
    }

    /**
     * Update the specified sale.
     */
    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $oldStatus = $sale->status;
        $itemsData = $request->items;
        $userId = $request->user()->id;

        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $sale, $itemsData, $oldStatus, $userId) {
            // Revert stock for existing items if not already cancelled
            if ($oldStatus !== 'ANNULE') {
                foreach ($sale->items as $existingItem) {
                    if ($existingItem->stock_id) {
                        $stock = Stock::lockForUpdate()->find($existingItem->stock_id);
                        if ($stock) {
                            $before = (int) $stock->quantity;
                            $stock->quantity = $before + (int) $existingItem->quantity;
                            $stock->save();
                            $this->movements->recordSaleIn(
                                $stock->id,
                                $stock->product_id,
                                $before,
                                (int) $stock->quantity,
                                $sale->id,
                                $userId
                            );
                        }
                    }
                }
            }

            // Delete old items
            $sale->items()->delete();

            // Calculate totals
            $totalQuantity = 0;
            $totalPurchase = 0;
            $totalSale = 0;

            foreach ($itemsData as $itemData) {
                $qte = $itemData['quantity'] ?? 1;
                $purchP = floatval($itemData['purchase_price'] ?? 0);
                $sellP = floatval($itemData['selling_price'] ?? 0);

                $totalQuantity += $qte;
                $totalPurchase += ($purchP * $qte);
                $totalSale += ($sellP * $qte);
            }

            $margin = $totalSale - $totalPurchase;

            $saleData = array_merge(
                $request->except('items'),
                [
                    'total_quantity' => $totalQuantity,
                    'total_purchase' => $totalPurchase,
                    'total_sale' => $totalSale,
                    'margin' => $margin,
                    'updated_by' => $userId,
                ]
            );

            // If updating to ANNULE, we don't deduct stock for new items
            $newStatus = $request->input('status', $oldStatus);
            $sale->update($saleData);

            // Re-create items and deduct stock (only if not cancelled)
            foreach ($itemsData as $itemData) {
                $qte = $itemData['quantity'] ?? 1;
                $purchP = floatval($itemData['purchase_price'] ?? 0);
                $sellP = floatval($itemData['selling_price'] ?? 0);

                $sale->items()->create([
                    'product_id' => $itemData['product_id'],
                    'stock_id' => $itemData['stock_id'] ?? null,
                    'quantity' => $qte,
                    'purchase_price' => $purchP,
                    'selling_price' => $sellP,
                    'total_purchase' => $purchP * $qte,
                    'total_sale' => $sellP * $qte,
                    'margin' => ($sellP * $qte) - ($purchP * $qte),
                ]);

                if ($newStatus !== 'ANNULE' && !empty($itemData['stock_id'])) {
                    $stock = Stock::lockForUpdate()->find($itemData['stock_id']);
                    $before = (int) $stock->quantity;
                    $stock->quantity = $before - $qte;
                    $stock->save();
                    $this->movements->recordSaleOut(
                        $stock->id,
                        $stock->product_id,
                        $before,
                        (int) $stock->quantity,
                        $sale->id,
                        $userId
                    );
                }
            }
        });

        return response()->json($sale->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'items.stock']));
    }

    /**
     * Remove the specified sale.
     */
    public function destroy(Request $request, Sale $sale): JsonResponse
    {
        $userId = $request->user()?->id;

        \Illuminate\Support\Facades\DB::transaction(function () use ($sale, $userId) {
            // Restore stock quantity for all items (unless sale was already cancelled)
            if ($sale->status !== 'ANNULE') {
                foreach ($sale->items as $item) {
                    if ($item->stock_id) {
                        $stock = Stock::lockForUpdate()->find($item->stock_id);
                        if ($stock) {
                            $before = (int) $stock->quantity;
                            $stock->quantity = $before + (int) $item->quantity;
                            $stock->save();
                            $this->movements->recordSaleIn(
                                $stock->id,
                                $stock->product_id,
                                $before,
                                (int) $stock->quantity,
                                $sale->id,
                                $userId
                            );
                        }
                    }
                }
            }

            // Delete linked transactions and payments
            $transactionIds = $sale->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
            $sale->payments()->delete();
            if ($transactionIds->isNotEmpty()) {
                Transaction::whereIn('id', $transactionIds)->delete();
            }

            $sale->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Get summary KPIs (all fields are unfiltered snapshots).
     */
    public function summary(Request $request): JsonResponse
    {
        // Monthly tyres sold (current month, unfiltered)
        $tyresThisMonth = Sale::whereYear('date', now()->year)
            ->whereMonth('date', now()->month)
            ->sum('total_quantity');

        // Today's tyres sold (unfiltered)
        $tyresToday = Sale::whereDate('date', now()->toDateString())
            ->sum('total_quantity');

        // EN COURS stats (unfiltered)
        $enCoursQuery = Sale::where('status', 'EN COURS');
        $tyresEnCours = (clone $enCoursQuery)->sum('total_quantity');
        $salesEnCours = (clone $enCoursQuery)->count();

        // Unpaid total (unfiltered)
        $totalUnpaid = Sale::where('payment_status', 'NON PAYE')->sum('total_sale');

        return response()->json([
            'tyres_this_month' => (int) $tyresThisMonth,
            'tyres_today' => (int) $tyresToday,
            'tyres_en_cours' => (int) $tyresEnCours,
            'sales_en_cours' => (int) $salesEnCours,
            'total_unpaid' => round($totalUnpaid, 2),
        ]);
    }

    /**
     * Get distinct values for filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        return response()->json([
            'brands' => \App\Models\Brand::whereIn('id', function ($q) {
                    $q->select('brand_id')
                      ->from('products')
                      ->whereIn('id', \App\Models\SaleItem::query()->whereNotNull('product_id')->select('product_id'));
                })
                ->orderBy('name')
                ->pluck('name')
                ->values(),
            'clients' => Sale::distinct()->whereNotNull('client')->pluck('client')->sort()->values(),
            'cities' => Sale::distinct()->whereNotNull('city')->pluck('city')->sort()->values(),
            'statuses' => Sale::distinct()->whereNotNull('status')->pluck('status')->sort()->values(),
            'payment_statuses' => Sale::distinct()->whereNotNull('payment_status')->pluck('payment_status')->sort()->values(),
            'partners' => \App\Models\Partner::pluck('name')->sort()->values(),
            'commercials' => User::role(['Commercial', 'Manager', 'Administrator'])->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
