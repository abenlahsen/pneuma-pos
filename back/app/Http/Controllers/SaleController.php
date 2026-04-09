<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSaleRequest;
use App\Http\Requests\UpdateSaleRequest;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    /**
     * Display a paginated list of sales with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()->with(['commercial', 'items.linkedProduct.brand', 'items.stock', 'creator', 'updater']);

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
            $query->whereHas('items.linkedProduct.brand', function ($q) use ($request) {
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
        // 1. Validate all stocks first
        $itemsData = $request->items;
        foreach ($itemsData as $itemIndex => $itemData) {
            $stock = Stock::find($itemData['stock_id']);
            if (!$stock || $stock->quantity < ($itemData['quantity'] ?? 1)) {
                return response()->json([
                    'message' => 'Quantité insuffisante en stock.',
                    'errors' => ["items.{$itemIndex}.stock_id" => ['Quantité insuffisante en stock. Disponible: ' . ($stock->quantity ?? 0)]],
                ], 422);
            }
        }

        $sale = \Illuminate\Support\Facades\DB::transaction(function () use ($request, $itemsData) {
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
                    'created_by' => $request->user()->id,
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
                    'stock_id' => $itemData['stock_id'],
                    'quantity' => $qte,
                    'purchase_price' => $purchP,
                    'selling_price' => $sellP,
                    'total_purchase' => $purchP * $qte,
                    'total_sale' => $sellP * $qte,
                    'margin' => ($sellP * $qte) - ($purchP * $qte),
                ]);

                Stock::where('id', $itemData['stock_id'])->decrement('quantity', $qte);
            }

            return $sale;
        });

        return response()->json($sale->load(['items.linkedProduct.brand', 'items.stock']), 201);
    }

    /**
     * Display the specified sale.
     */
    public function show(Sale $sale): JsonResponse
    {
        return response()->json($sale->load(['commercial', 'items.linkedProduct.brand', 'items.stock', 'creator', 'updater']));
    }

    /**
     * Update the specified sale.
     */
    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        $oldStatus = $sale->status;
        $itemsData = $request->items;

        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $sale, $itemsData, $oldStatus) {
            // Revert stock for existing items if not already cancelled
            if ($oldStatus !== 'ANNULE') {
                foreach ($sale->items as $existingItem) {
                    if ($existingItem->stock_id) {
                        Stock::where('id', $existingItem->stock_id)->increment('quantity', $existingItem->quantity);
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
                    'updated_by' => $request->user()->id,
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
                    'stock_id' => $itemData['stock_id'],
                    'quantity' => $qte,
                    'purchase_price' => $purchP,
                    'selling_price' => $sellP,
                    'total_purchase' => $purchP * $qte,
                    'total_sale' => $sellP * $qte,
                    'margin' => ($sellP * $qte) - ($purchP * $qte),
                ]);

                if ($newStatus !== 'ANNULE') {
                    Stock::where('id', $itemData['stock_id'])->decrement('quantity', $qte);
                }
            }
        });

        return response()->json($sale->load(['items.linkedProduct.brand', 'items.stock']));
    }

    /**
     * Remove the specified sale.
     */
    public function destroy(Sale $sale): JsonResponse
    {
        // Restore stock quantity for all items (unless sale was already cancelled)
        if ($sale->status !== 'ANNULE') {
            foreach ($sale->items as $item) {
                if ($item->stock_id) {
                    Stock::where('id', $item->stock_id)->increment('quantity', $item->quantity);
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

        return response()->json(null, 204);
    }

    /**
     * Get summary totals with optional filters.
     */
    public function summary(Request $request): JsonResponse
    {
        $query = Sale::query();

        // Apply same filters as index
        if ($request->filled('brand')) {
            $query->whereHas('items.linkedProduct.brand', function ($q) use ($request) {
                $q->where('name', $request->brand);
            });
        }

        $fields = ['city', 'payment_method', 'status', 'payment_status'];
        foreach ($fields as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->$field);
            }
        }

        if ($request->filled('client')) {
            $query->where('client', 'like', '%' . $request->client . '%');
        }

        if ($request->filled('partner')) {
            $query->whereHas('partner', function($q) use ($request) {
                $q->where('name', $request->partner);
            });
        }

        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        $totalPurchase = (clone $query)->sum('total_purchase');
        $totalSale = (clone $query)->sum('total_sale');

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
            'total_purchase' => round($totalPurchase, 2),
            'total_sale' => round($totalSale, 2),
            'margin' => round($totalSale - $totalPurchase, 2),
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
