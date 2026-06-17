<?php

namespace App\Http\Controllers;

use App\Models\KpiSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KpiHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from'     => 'nullable|date',
            'to'       => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:365',
        ]);

        $query = KpiSnapshot::query()->orderBy('snapshot_date', 'desc');

        if ($from = $request->query('from')) {
            $query->where('snapshot_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('snapshot_date', '<=', $to);
        }

        $perPage = (int) ($request->query('per_page', 30));
        $paginated = $query->paginate($perPage);

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }
}
