<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityLog::with('user')->latest('created_at');

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->string('entity_type'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->string('action'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->string('date_from') . ' 00:00:00');
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->string('date_to') . ' 23:59:59');
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('entity_label', 'like', "%{$search}%")
                  ->orWhere('user_name', 'like', "%{$search}%");
            });
        }

        $perPage = (int) ($request->integer('per_page') ?: 50);
        $result = $query->paginate($perPage);

        return response()->json([
            'data'         => $result->items(),
            'current_page' => $result->currentPage(),
            'last_page'    => $result->lastPage(),
            'total'        => $result->total(),
            'per_page'     => $result->perPage(),
        ]);
    }

    public function filters(): JsonResponse
    {
        $entityTypes = ActivityLog::distinct()->pluck('entity_type')->sort()->values();
        $actions     = ActivityLog::distinct()->pluck('action')->sort()->values();
        $users       = User::whereIn('id', ActivityLog::distinct()->pluck('user_id')->filter())
                           ->orderBy('name')
                           ->get(['id', 'name']);

        return response()->json(compact('entityTypes', 'actions', 'users'));
    }
}
