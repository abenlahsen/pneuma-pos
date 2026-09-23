<?php

namespace App\Http\Controllers;

use App\Domain\Reporting\MonthlyReportService;
use App\Enums\SaleStatus;
use App\Enums\ServiceOrderStatus;
use App\Models\CompanySetting;
use App\Models\PrimeThreshold;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrimesController extends Controller
{
    public function __construct(private MonthlyReportService $reportService) {}

    public function index(Request $request): JsonResponse
    {
        $year  = (int) ($request->input('year', now()->year));
        $month = (int) ($request->input('month', now()->month));

        $start = Carbon::createFromDate($year, $month, 1)->startOfDay();
        $end   = $start->copy()->endOfMonth()->endOfDay();

        $settings = CompanySetting::first();
        $primeThreshold = (int) ($settings?->prime_threshold ?? 0);

        // Cancelled sales and cancelled service orders are excluded everywhere
        // in this controller — per commercial, in the daily series and in the
        // six-month history. A cancelled sale used to count towards the
        // collective threshold and towards its seller's bonus, while the
        // dashboard and the monthly report already left it out; the three
        // screens now agree on what a sold tyre is.

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
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
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
            ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
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
            'data'       => $data,
            'daily'      => $this->dailyTyres($start, $end),
            'net_margin' => $this->reportService->netMargin($year, $month),
            'history'    => $this->history($start),
        ]);
    }

    /**
     * The six months before the one being shown — refonte 2b, 9b.
     *
     * Each month carries the threshold that applied AT ITS END, read from
     * `prime_thresholds`. A month older than the first recorded value comes
     * back with `prime_threshold: null`: the table starts counting from the
     * day it was created and recovers nothing from before. The screen shows a
     * dash there rather than a verdict it cannot support.
     *
     * @return array<int, array{year: int, month: int, shop_total_tyres: int, prime_threshold: int|null}>
     */
    private function history(Carbon $currentStart): array
    {
        $months = [];

        for ($back = 1; $back <= 6; $back++) {
            $monthStart = $currentStart->copy()->subMonthsNoOverflow($back);
            $monthEnd = $monthStart->copy()->endOfMonth();

            $months[] = [
                'year' => $monthStart->year,
                'month' => $monthStart->month,
                'shop_total_tyres' => $this->tyresBetween($monthStart, $monthEnd->copy()->endOfDay()),
                'prime_threshold' => PrimeThreshold::inForceOn($monthEnd->toDateString()),
            ];
        }

        return $months;
    }

    /**
     * Total tyres over a range — the same measurement as `shop_total_tyres`,
     * so a past month and the current one are counted identically.
     */
    private function tyresBetween(Carbon $start, Carbon $end): int
    {
        $sales = (int) DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('products.type', 'tyre')
            ->whereBetween('sales.date', [$start, $end])
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
            ->sum('sale_items.quantity');

        $service = (int) DB::table('service_items')
            ->join('products', 'service_items.product_id', '=', 'products.id')
            ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
            ->where('products.type', 'tyre')
            ->where('service_items.item_type', 'part')
            ->whereBetween('service_orders.date', [$start, $end])
            ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
            ->sum('service_items.quantity');

        return $sales + $service;
    }

    /**
     * Tyres sold day by day over the month — refonte 2b, 9b.
     *
     * Every day of the month is present, zeros included: the screen reads the
     * series as a calendar (pace since the 1st, gauge), and a sparse array
     * would let a closed day pass for a missing one.
     *
     * The filters are deliberately the SAME as the totals above, cancellation
     * included, so that `sum(daily.total_tyres)` always equals
     * `shop_total_tyres`. Any divergence here would make the gauge lie.
     *
     * @return array<int, array{date: string, sale_tyres: int, so_tyres: int, total_tyres: int}>
     */
    private function dailyTyres(Carbon $start, Carbon $end): array
    {
        $saleDaily = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('products.type', 'tyre')
            ->whereBetween('sales.date', [$start, $end])
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
            ->selectRaw('DATE(sales.date) as d, SUM(sale_items.quantity) as qty')
            ->groupBy('d')
            ->pluck('qty', 'd');

        $soDaily = DB::table('service_items')
            ->join('products', 'service_items.product_id', '=', 'products.id')
            ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
            ->where('products.type', 'tyre')
            ->where('service_items.item_type', 'part')
            ->whereBetween('service_orders.date', [$start, $end])
            ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
            ->selectRaw('DATE(service_orders.date) as d, SUM(service_items.quantity) as qty')
            ->groupBy('d')
            ->pluck('qty', 'd');

        $days = [];

        for ($day = $start->copy(); $day->lte($end); $day->addDay()) {
            $key       = $day->toDateString();
            $saleTyres = (int) ($saleDaily[$key] ?? 0);
            $soTyres   = (int) ($soDaily[$key] ?? 0);

            $days[] = [
                'date'        => $key,
                'sale_tyres'  => $saleTyres,
                'so_tyres'    => $soTyres,
                'total_tyres' => $saleTyres + $soTyres,
            ];
        }

        return $days;
    }
}
