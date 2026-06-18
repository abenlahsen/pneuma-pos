<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\Stock;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardKpiService
{
    /**
     * Calculate all dashboard KPIs for a given reference date.
     *
     * For the live dashboard, pass Carbon::today() — month/year ranges extend to end of period.
     * For a daily snapshot, pass the target date — month/year ranges are capped at that date.
     */
    public function calculate(Carbon $date, bool $snapshot = false): array
    {
        $today = $date->toDateString();
        $monthStart = $date->copy()->startOfMonth()->toDateString();
        $monthEnd   = $snapshot ? $today : $date->copy()->endOfMonth()->toDateString();
        $yearStart  = $date->copy()->startOfYear()->toDateString();
        $yearEnd    = $snapshot ? $today : $date->copy()->endOfYear()->toDateString();

        $salesToday      = Sale::whereDate('date', $today);
        $purchasesToday  = Purchase::whereDate('date', $today);
        $salesMonth      = Sale::whereBetween('date', [$monthStart, $monthEnd]);
        $salesYear       = Sale::whereBetween('date', [$yearStart, $yearEnd]);
        $purchasesMonth  = Purchase::whereBetween('date', [$monthStart, $monthEnd]);
        $purchasesYear   = Purchase::whereBetween('date', [$yearStart, $yearEnd]);

        $tyreSalesQty = function (string $start, ?string $end = null): int {
            $q = DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('products.type', 'tyre');
            $end ? $q->whereBetween('sales.date', [$start, $end]) : $q->whereDate('sales.date', $start);

            return (int) $q->sum('sale_items.quantity');
        };

        $partsSoldQty = function (string $start, ?string $end = null): int {
            $q = DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('products.type', 'part');
            $end ? $q->whereBetween('sales.date', [$start, $end]) : $q->whereDate('sales.date', $start);
            $fromSales = (int) $q->sum('sale_items.quantity');

            $sq = DB::table('service_items')
                ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
                ->where('service_items.item_type', 'part')
                ->where('service_orders.status', '!=', 'ANNULE');
            $end ? $sq->whereBetween('service_orders.date', [$start, $end]) : $sq->whereDate('service_orders.date', $start);
            $fromService = (int) $sq->sum('service_items.quantity');

            return $fromSales + $fromService;
        };

        $tyrePurchaseQty = fn (string $start, string $end): int => (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', 'tyre')
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');

        $partsPurchasedQty = fn (string $start, string $end): int => (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', 'part')
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');

        $purchasesTotalLifetime = (float) Purchase::sum('total_price');
        $purchasesPaidLifetime  = (float) Purchase::where('payment_status', 'PAYE')->sum('total_price');

        $tyreItemsSub = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('products.type', 'tyre')
            ->selectRaw('sale_items.sale_id, SUM(sale_items.quantity) as tyre_qty')
            ->groupBy('sale_items.sale_id');

        $expenseCategories = ['Charge', 'Transport', 'Service'];

        $expensesToday = round((float) Transaction::where('type', 'expense')
            ->whereIn('category', $expenseCategories)
            ->whereDate('date', $today)
            ->sum('amount'), 2);

        $expensesMonth = round((float) Transaction::where('type', 'expense')
            ->whereIn('category', $expenseCategories)
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->sum('amount'), 2);

        $expensesYear = round((float) Transaction::where('type', 'expense')
            ->whereIn('category', $expenseCategories)
            ->whereBetween('date', [$yearStart, $yearEnd])
            ->sum('amount'), 2);

        $caServiceToday = round((float) ServiceOrder::whereDate('date', $today)
            ->where('status', '!=', 'ANNULE')->sum('net_amount'), 2);
        $caServiceMonth = round((float) ServiceOrder::whereBetween('date', [$monthStart, $monthEnd])
            ->where('status', '!=', 'ANNULE')->sum('net_amount'), 2);
        $caServiceYear  = round((float) ServiceOrder::whereBetween('date', [$yearStart, $yearEnd])
            ->where('status', '!=', 'ANNULE')->sum('net_amount'), 2);

        $serviceMargin = function (string $start, ?string $end = null): float {
            $q = DB::table('service_items')
                ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
                ->leftJoin('stocks', 'service_items.stock_id', '=', 'stocks.id')
                ->where('service_orders.status', '!=', 'ANNULE')
                ->selectRaw("SUM(CASE
                    WHEN service_items.item_type = 'service'
                        THEN service_items.line_total
                    ELSE service_items.line_total - service_items.quantity * COALESCE(stocks.purchase_price, 0)
                END) as margin");

            $end
                ? $q->whereBetween('service_orders.date', [$start, $end])
                : $q->whereDate('service_orders.date', $start);

            return round((float) ($q->value('margin') ?? 0), 2);
        };

        $marginServiceToday = $serviceMargin($today);
        $marginServiceMonth = $serviceMargin($monthStart, $monthEnd);
        $marginServiceYear  = $serviceMargin($yearStart, $yearEnd);

        $mapCommercials = function ($rows): array {
            return $rows->map(function ($item) {
                $totalSales  = (float) $item->total_sales;
                $totalMargin = (float) $item->total_margin;
                $totalTyres  = (int) $item->total_tyres;

                return [
                    'commercial_name'     => $item->commercial_name ?? 'Non assigné',
                    'total_sales'         => round($totalSales, 2),
                    'total_tyres'         => $totalTyres,
                    'total_margin'        => round($totalMargin, 2),
                    'total_unpaid'        => round((float) $item->total_unpaid, 2),
                    'avg_margin_per_tyre' => $totalTyres > 0 ? round($totalMargin / $totalTyres, 2) : 0,
                    'margin_rate'         => $totalSales > 0 ? round(($totalMargin / $totalSales) * 100, 1) : 0,
                ];
            })->toArray();
        };

        $mapServiceCommercials = function ($rows): array {
            return collect($rows)->map(function ($item) {
                $ca     = (float) ($item->so_ca     ?? 0);
                $margin = (float) ($item->so_margin ?? 0);

                return [
                    'commercial_name' => $item->commercial_name ?? 'Non assigné',
                    'total_ca'        => round($ca, 2),
                    'total_orders'    => (int) ($item->so_count ?? 0),
                    'total_margin'    => round($margin, 2),
                    'total_unpaid'    => round((float) ($item->so_unpaid ?? 0), 2),
                    'margin_rate'     => $ca > 0 ? round(($margin / $ca) * 100, 1) : 0,
                ];
            })->sortByDesc(fn ($r) => $r['total_ca'])->values()->toArray();
        };

        $commercialSelectRaw = "COALESCE(users.name, 'Non assigné') as commercial_name,
            SUM(sales.total_sale) as total_sales,
            COALESCE(SUM(tyre_items.tyre_qty), 0) as total_tyres,
            SUM(sales.margin) as total_margin,
            SUM(CASE WHEN sales.payment_status IN ('NON PAYE', 'PARTIEL')
                THEN sales.total_sale - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = sales.id), 0)
                ELSE 0 END) as total_unpaid";

        $soCommercialRaw = "COALESCE(users.name, 'Non assigné') as commercial_name,
            COUNT(service_orders.id) as so_count,
            SUM(service_orders.net_amount) as so_ca,
            SUM((
                SELECT COALESCE(SUM(CASE
                    WHEN si.item_type = 'service' THEN si.line_total
                    ELSE si.line_total - si.quantity * COALESCE(stk.purchase_price, 0)
                END), 0)
                FROM service_items si
                LEFT JOIN stocks stk ON si.stock_id = stk.id
                WHERE si.service_order_id = service_orders.id
            )) as so_margin,
            SUM(CASE WHEN service_orders.payment_status IN ('NON PAYE', 'PARTIEL')
                THEN service_orders.net_amount - COALESCE((
                    SELECT SUM(sp.amount) FROM service_payments sp
                    WHERE sp.service_order_id = service_orders.id
                ), 0)
                ELSE 0 END) as so_unpaid";

        $soByMonth = DB::table('service_orders')
            ->leftJoin('users', 'service_orders.commercial_id', '=', 'users.id')
            ->where('service_orders.status', '!=', 'ANNULE')
            ->whereBetween('service_orders.date', [$monthStart, $monthEnd])
            ->selectRaw($soCommercialRaw)
            ->groupBy('service_orders.commercial_id', 'users.name')
            ->get();

        $soByYear = DB::table('service_orders')
            ->leftJoin('users', 'service_orders.commercial_id', '=', 'users.id')
            ->where('service_orders.status', '!=', 'ANNULE')
            ->whereBetween('service_orders.date', [$yearStart, $yearEnd])
            ->selectRaw($soCommercialRaw)
            ->groupBy('service_orders.commercial_id', 'users.name')
            ->get();

        $rawSalesMonth = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.date', [$monthStart, $monthEnd])
            ->selectRaw($commercialSelectRaw)
            ->groupBy('sales.commercial_id', 'users.name')
            ->get();

        $rawSalesYear = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.date', [$yearStart, $yearEnd])
            ->selectRaw($commercialSelectRaw)
            ->groupBy('sales.commercial_id', 'users.name')
            ->get();

        $salesTodayAmount = round((clone $salesToday)->sum('total_sale'), 2);
        $marginSalesToday = round((clone $salesToday)->sum('margin'), 2);
        $salesMonthAmount = round((clone $salesMonth)->sum('total_sale'), 2);
        $marginSalesMonth = round((clone $salesMonth)->sum('margin'), 2);
        $salesYearAmount  = round((clone $salesYear)->sum('total_sale'), 2);
        $marginSalesYear  = round((clone $salesYear)->sum('margin'), 2);

        return [
            // Today
            'sales_today_amount'     => $salesTodayAmount + $caServiceToday,
            'tyres_today'            => $tyreSalesQty($today),
            'margin_today'           => $marginSalesToday + $marginServiceToday,
            'net_margin_today'       => $marginSalesToday + $marginServiceToday - $expensesToday,
            'purchases_today_amount' => round((clone $purchasesToday)->sum('total_price'), 2),
            'tyres_purchased_today'  => $tyrePurchaseQty($today, $today),
            'expenses_today'         => $expensesToday,

            // Month
            'sales_month_amount'     => $salesMonthAmount + $caServiceMonth,
            'purchases_month_amount' => round((clone $purchasesMonth)->sum('total_price'), 2),
            'margin_month'           => $marginSalesMonth + $marginServiceMonth,
            'net_margin_month'       => $marginSalesMonth + $marginServiceMonth - $expensesMonth,
            'expenses_month'         => $expensesMonth,
            'tyres_month'            => $tyreSalesQty($monthStart, $monthEnd),
            'parts_month'            => $partsSoldQty($monthStart, $monthEnd),
            'tyres_purchased_month'  => $tyrePurchaseQty($monthStart, $monthEnd),
            'parts_purchased_month'  => $partsPurchasedQty($monthStart, $monthEnd),

            // Year
            'margin_year'            => $marginSalesYear + $marginServiceYear,
            'net_margin_year'        => $marginSalesYear + $marginServiceYear - $expensesYear,
            'expenses_year'          => $expensesYear,
            'total_sale_year'        => $salesYearAmount + $caServiceYear,
            'total_purchase_year'    => round((clone $purchasesYear)->sum('total_price'), 2),
            'tyres_year'             => $tyreSalesQty($yearStart, $yearEnd),
            'parts_year'             => $partsSoldQty($yearStart, $yearEnd),
            'tyres_purchased_year'   => $tyrePurchaseQty($yearStart, $yearEnd),
            'parts_purchased_year'   => $partsPurchasedQty($yearStart, $yearEnd),

            // By commercial
            'sales_by_commercial'        => $mapCommercials($rawSalesMonth),
            'sales_by_commercial_year'   => $mapCommercials($rawSalesYear),
            'service_by_commercial'      => $mapServiceCommercials($soByMonth),
            'service_by_commercial_year' => $mapServiceCommercials($soByYear),

            // Stock (point-in-time — always current)
            'stock_quantity' => (int) Stock::sum('quantity'),
            'stock_value'    => round(
                (float) (Stock::selectRaw('SUM(quantity * purchase_price) as t')->value('t') ?? 0),
                2
            ),

            // Receivables / payables (lifetime totals)
            'unpaid_sales'     => round(Sale::where('payment_status', 'NON PAYE')->sum('total_sale'), 2),
            'unpaid_purchases' => round($purchasesTotalLifetime - $purchasesPaidLifetime, 2),

            // Cash balance (always current)
            'cash_balance' => round(
                Account::where('type', 'cash')->get()->sum('current_balance'),
                2
            ),
        ];
    }
}
