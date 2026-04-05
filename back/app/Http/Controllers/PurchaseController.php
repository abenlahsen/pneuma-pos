<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Purchase;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $query = Purchase::with(['supplier', 'commercial', 'linkedProduct.brand', 'creator', 'updater']);

        // Sorting
        $sortable = ['date', 'product', 'quantity', 'unit_price', 'payment_status', 'status', 'created_at', 'updated_at'];
        if ($request->filled('sort_by') && in_array($request->sort_by, $sortable)) {
            $direction = $request->get('sort_direction', 'asc') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($request->sort_by, $direction);
        } else {
            $query->latest();
        }

        // Text search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('product', 'like', "%{$search}%")
                  ->orWhereHas('supplier', function ($q2) use ($search) {
                      $q2->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('commercial', function ($q2) use ($search) {
                      $q2->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('linkedProduct', function ($q2) use ($search) {
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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'product' => 'nullable|string|max:255',
            'product_id' => 'required|exists:products,id',
            'stock_id' => 'required|exists:stocks,id',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'nullable|exists:users,id',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'status' => 'required|string|in:EN COURS,RECU,ANNULE,RETOUR',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
        ]);

        $purchase = Purchase::create(array_merge($validated, [
            'created_by' => $request->user()->id,
        ]));

        // Increase stock quantity
        if ($purchase->stock_id) {
            Stock::where('id', $purchase->stock_id)->increment('quantity', $purchase->quantity ?? 0);
        }

        return response()->json($purchase->load(['supplier', 'commercial', 'linkedProduct.brand']), 201);
    }

    public function show(Purchase $purchase)
    {
        return response()->json($purchase->load(['supplier', 'commercial', 'linkedProduct.brand']));
    }

    public function update(Request $request, Purchase $purchase)
    {
        $validated = $request->validate([
            'date' => 'nullable|date',
            'product' => 'nullable|string|max:255',
            'product_id' => 'nullable|exists:products,id',
            'stock_id' => 'nullable|exists:stocks,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'commercial_id' => 'nullable|exists:users,id',
            'quantity' => 'nullable|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:EN COURS,RECU,ANNULE,RETOUR',
            'payment_status' => 'nullable|string|in:PAYE,NON PAYE,PARTIEL',
        ]);

        $oldStatus = $purchase->status;
        $purchase->update(array_merge($validated, [
            'updated_by' => $request->user()->id,
        ]));

        // Remove stock if status changed to ANNULE or RETOUR (and wasn't already)
        if ($purchase->stock_id && in_array($purchase->status, ['ANNULE', 'RETOUR']) && !in_array($oldStatus, ['ANNULE', 'RETOUR'])) {
            Stock::where('id', $purchase->stock_id)->decrement('quantity', $purchase->quantity ?? 0);
        }

        return response()->json($purchase->load(['supplier', 'commercial', 'linkedProduct.brand']));
    }

    public function destroy(Purchase $purchase)
    {
        // Remove from stock (unless already cancelled/returned, which already decremented stock)
        if ($purchase->stock_id && !in_array($purchase->status, ['ANNULE', 'RETOUR'])) {
            Stock::where('id', $purchase->stock_id)->decrement('quantity', $purchase->quantity ?? 0);
        }

        // Delete linked transactions and payments
        $transactionIds = $purchase->payments()->whereNotNull('transaction_id')->pluck('transaction_id');
        $purchase->payments()->delete();
        if ($transactionIds->isNotEmpty()) {
            Transaction::whereIn('id', $transactionIds)->delete();
        }

        $purchase->delete();
        return response()->json(null, 204);
    }

    public function summary(Request $request)
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

        $totalAchats = (clone $query)->selectRaw('SUM(unit_price * quantity) as total')->value('total') ?? 0;
        $totalPaye = (clone $query)->where('payment_status', 'PAYE')->selectRaw('SUM(unit_price * quantity) as total')->value('total') ?? 0;
        $resteAPayer = $totalAchats - $totalPaye;

        return response()->json([
            'total_achats' => round($totalAchats, 2),
            'total_paye' => round($totalPaye, 2),
            'reste_a_payer' => round($resteAPayer, 2),
        ]);
    }

    public function filters()
    {
        return response()->json([
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name']),
            'commercials' => User::role('Commercial')->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
