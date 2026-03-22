<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Purchase;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $query = Purchase::with(['supplier', 'commercial']);
        
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('product', 'like', "%{$search}%")
                  ->orWhereHas('supplier', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('commercial', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  });
        }
        
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        return $query->latest()->paginate(10);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'product' => 'required|string|max:255',
            'supplier_id' => 'required|exists:suppliers,id',
            'commercial_id' => 'nullable|exists:personnels,id',
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
            'commercial_id' => 'nullable|exists:personnels,id',
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

    public function summary()
    {
        $totalAchats = Purchase::selectRaw('SUM(unit_price * quantity) as total')->value('total') ?? 0;
        $totalPaye = Purchase::where('payment_status', 'PAYE')->selectRaw('SUM(unit_price * quantity) as total')->value('total') ?? 0;
        $resteAPayer = $totalAchats - $totalPaye;

        return response()->json([
            'total_achats' => $totalAchats,
            'total_paye' => $totalPaye,
            'reste_a_payer' => $resteAPayer,
        ]);
    }

}
