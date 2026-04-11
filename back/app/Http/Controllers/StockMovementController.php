<?php

namespace App\Http\Controllers;

use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = StockMovement::query()
            ->with(['user:id,name', 'stock:id,depot,zone'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('stock_id')) {
            $query->where('stock_id', $request->stock_id);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->to);
        }

        return response()->json($query->paginate($request->get('per_page', 50)));
    }
}
