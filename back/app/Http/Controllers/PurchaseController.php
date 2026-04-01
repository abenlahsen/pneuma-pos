<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\User;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $query = Purchase::with(['supplier', 'commercial']);

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
            'product' => 'required|string|max:255',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'nullable|exists:users,id',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'status' => 'required|string|in:EN COURS,RECU',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
        ]);

        $purchase = Purchase::create($validated);

        return response()->json($purchase->load(['supplier', 'commercial']), 201);
    }

    public function show(Purchase $purchase)
    {
        return response()->json($purchase->load(['supplier', 'commercial']));
    }

    public function update(Request $request, Purchase $purchase)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'product' => 'required|string|max:255',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'nullable|exists:users,id',
            'quantity' => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'status' => 'required|string|in:EN COURS,RECU',
            'payment_status' => 'required|string|in:PAYE,NON PAYE,PARTIEL',
        ]);

        $purchase->update($validated);

        return response()->json($purchase->load(['supplier', 'commercial']));
    }

    public function destroy(Purchase $purchase)
    {
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
