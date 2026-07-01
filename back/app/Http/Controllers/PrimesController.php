<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrimesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $year  = (int) ($request->input('year', now()->year));
        $month = (int) ($request->input('month', now()->month));

        $start = \Carbon\Carbon::createFromDate($year, $month, 1)->startOfDay();
        $end   = $start->copy()->endOfMonth()->endOfDay();

        $settings = CompanySetting::first();
        $primeThreshold = (int) ($settings?->prime_threshold ?? 0);

        // Tyre qty per commercial from Sales
        $saleTyresSub = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('products.type', 'tyre')
            ->selectRaw('sale_items.sale_id, SUM(sale_items.quantity) as qty')
            ->groupBy('sale_items.sale_id');

        $salesRows = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($saleTyresSub, 'st', 'st.sale_id', '=', 'sales.id')
            ->whereBetween('sales.date', [$start, $end])
            ->selectRaw('sales.commercial_id,
                COALESCE(users.name, "Non assigné") as commercial_name,
                COALESCE(users.prime_per_tyre, 0) as prime_per_tyre,
                COALESCE(SUM(st.qty), 0) as sale_tyres')
            ->groupBy('sales.commercial_id', 'users.name', 'users.prime_per_tyre')
            ->get()
            ->keyBy('commercial_id');

        // Tyre qty per commercial from Service Orders (part lines linked to tyre products)
        $soRows = DB::table('service_items')
            ->join('products', 'service_items.product_id', '=', 'products.id')
            ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
            ->where('products.type', 'tyre')
            ->where('service_items.item_type', 'part')
            ->whereBetween('service_orders.date', [$start, $end])
            ->selectRaw('service_orders.commercial_id, SUM(service_items.quantity) as so_tyres')
            ->groupBy('service_orders.commercial_id')
            ->get()
            ->keyBy('commercial_id');

        // Merge: collect all commercial_ids from both sources
        $allIds = $salesRows->keys()->merge($soRows->keys())->unique();

        $rows = $allIds->map(function ($commercialId) use ($salesRows, $soRows) {
            $sale = $salesRows->get($commercialId);
            $so   = $soRows->get($commercialId);

            $saleTyres = (int) ($sale?->sale_tyres ?? 0);
            $soTyres   = (int) ($so?->so_tyres ?? 0);

            // Resolve commercial name and prime_per_tyre from whichever source has it
            $commercialName = $sale?->commercial_name ?? 'Non assigné';
            $primePerTyre   = (float) ($sale?->prime_per_tyre ?? 0);

            // If we only have SO data, fetch from users table
            if (! $sale && $commercialId) {
                $user = DB::table('users')->where('id', $commercialId)->first();
                if ($user) {
                    $commercialName = $user->name;
                    $primePerTyre   = (float) ($user->prime_per_tyre ?? 0);
                }
            }

            return [
                'commercial_id'   => $commercialId,
                'commercial_name' => $commercialName,
                'sale_tyres'      => $saleTyres,
                'so_tyres'        => $soTyres,
                'total_tyres'     => $saleTyres + $soTyres,
                'prime_per_tyre'  => $primePerTyre,
            ];
        })->values();

        // Shop total and eligibility
        $shopTotal     = $rows->sum('total_tyres');
        $primeEligible = $primeThreshold > 0 && $shopTotal >= $primeThreshold;

        // Compute prime_total per commercial
        $data = $rows->map(function ($row) use ($primeEligible) {
            $primeTotal = $primeEligible
                ? round($row['total_tyres'] * $row['prime_per_tyre'], 2)
                : 0;

            return [
                'commercial_id'   => $row['commercial_id'],
                'commercial_name' => $row['commercial_name'],
                'sale_tyres'      => $row['sale_tyres'],
                'so_tyres'        => $row['so_tyres'],
                'total_tyres'     => $row['total_tyres'],
                'prime_per_tyre'  => $row['prime_per_tyre'],
                'prime_total'     => $primeTotal,
            ];
        })->sortByDesc('total_tyres')->values();

        $totalPrimes = $data->sum('prime_total');

        return response()->json([
            'year'             => $year,
            'month'            => $month,
            'prime_threshold'  => $primeThreshold,
            'shop_total_tyres' => (int) $shopTotal,
            'prime_eligible'   => $primeEligible,
            'summary'          => [
                'total_primes'      => round($totalPrimes, 2),
                'total_commerciaux' => $data->count(),
            ],
            'data' => $data,
        ]);
    }
}
