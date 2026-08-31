<?php

namespace App\Http\Controllers;

use App\Domain\Suppliers\SupplierService;
use App\Enums\PurchaseStatus;
use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Enums\ServiceOrderStatus;
use App\Models\Account;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\ServiceOrder;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Aggregated KPI snapshot for the admin dashboard.
     */
    public function kpi(Request $request, SupplierService $supplierService): JsonResponse
    {
        $selectedDay = $request->query('day');
        $selectedMonth = $request->query('month');
        $selectedYear = $request->query('year');

        $dayDate = $selectedDay ? Carbon::createFromFormat('Y-m-d', $selectedDay) : now();
        $monthDate = $selectedMonth ? Carbon::createFromFormat('Y-m', $selectedMonth) : now();
        $yearDate = $selectedYear ? Carbon::createFromFormat('Y', $selectedYear) : now();

        $today = $dayDate->toDateString();
        $monthStart = $monthDate->copy()->startOfMonth()->toDateString();
        $monthEnd = $monthDate->copy()->endOfMonth()->toDateString();
        $yearStart = $yearDate->copy()->startOfYear()->toDateString();
        $yearEnd = $yearDate->copy()->endOfYear()->toDateString();

        // Cancelled sales/purchases must not inflate revenue, margin, or
        // quantity KPIs — matches the exclusion already applied to Service
        // Auto orders below.
        $saleAnnule = SaleStatus::ANNULE->value;
        $purchaseCancelledStatuses = [PurchaseStatus::ANNULE->value];

        $salesToday = Sale::whereDate('date', $today)->where('status', '!=', $saleAnnule);
        $purchasesToday = Purchase::whereDate('date', $today)->whereNotIn('status', $purchaseCancelledStatuses);
        $salesMonth = Sale::whereBetween('date', [$monthStart, $monthEnd])->where('status', '!=', $saleAnnule);
        $salesYear = Sale::whereBetween('date', [$yearStart, $yearEnd])->where('status', '!=', $saleAnnule);
        $purchasesMonth = Purchase::whereBetween('date', [$monthStart, $monthEnd])->whereNotIn('status', $purchaseCancelledStatuses);
        $purchasesYear = Purchase::whereBetween('date', [$yearStart, $yearEnd])->whereNotIn('status', $purchaseCancelledStatuses);

        $tyreSalesQty = function (string $start, ?string $end = null) use ($saleAnnule): int {
            $q = DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('products.type', 'tyre')
                ->where('sales.status', '!=', $saleAnnule);
            $end ? $q->whereBetween('sales.date', [$start, $end]) : $q->whereDate('sales.date', $start);

            return (int) $q->sum('sale_items.quantity');
        };

        $partsSoldQty = function (string $start, ?string $end = null) use ($saleAnnule): int {
            $q = DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('products.type', 'part')
                ->where('sales.status', '!=', $saleAnnule);
            $end ? $q->whereBetween('sales.date', [$start, $end]) : $q->whereDate('sales.date', $start);
            $fromSales = (int) $q->sum('sale_items.quantity');

            $sq = DB::table('service_items')
                ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
                ->where('service_items.item_type', 'part')
                ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value);
            $end ? $sq->whereBetween('service_orders.date', [$start, $end]) : $sq->whereDate('service_orders.date', $start);
            $fromService = (int) $sq->sum('service_items.quantity');

            return $fromSales + $fromService;
        };

        $tyrePurchaseQty = fn (string $start, string $end): int => (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', 'tyre')
            ->whereNotIn('purchases.status', $purchaseCancelledStatuses)
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');

        $partsPurchasedQty = fn (string $start, string $end): int => (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', 'part')
            ->whereNotIn('purchases.status', $purchaseCancelledStatuses)
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');

        $unpaidSuppliers = $supplierService->unpaidBySupplier();

        $tyreItemsSub = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('products.type', 'tyre')
            ->selectRaw('sale_items.sale_id, SUM(sale_items.quantity) as tyre_qty')
            ->groupBy('sale_items.sale_id');

        $expenseCategories = TransactionCategory::expenseKpiNames();

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

        // Cash-flow revenue with no linked Sale/ServiceOrder (e.g. 'Occasion')
        // — 100% margin, opted in per category via counts_as_revenue.
        $revenueCategories = TransactionCategory::revenueKpiNames();

        $otherRevenueToday = round((float) Transaction::where('type', 'income')
            ->whereIn('category', $revenueCategories)
            ->whereDate('date', $today)
            ->sum('amount'), 2);

        $otherRevenueMonth = round((float) Transaction::where('type', 'income')
            ->whereIn('category', $revenueCategories)
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->sum('amount'), 2);

        $otherRevenueYear = round((float) Transaction::where('type', 'income')
            ->whereIn('category', $revenueCategories)
            ->whereBetween('date', [$yearStart, $yearEnd])
            ->sum('amount'), 2);

        // Service Auto CA (net_amount after discount, excluding ANNULÉE)
        $caServiceToday = round((float) ServiceOrder::whereDate('date', $today)
            ->where('status', '!=', ServiceOrderStatus::ANNULE->value)->sum('net_amount'), 2);
        $caServiceMonth = round((float) ServiceOrder::whereBetween('date', [$monthStart, $monthEnd])
            ->where('status', '!=', ServiceOrderStatus::ANNULE->value)->sum('net_amount'), 2);
        $caServiceYear = round((float) ServiceOrder::whereBetween('date', [$yearStart, $yearEnd])
            ->where('status', '!=', ServiceOrderStatus::ANNULE->value)->sum('net_amount'), 2);

        // Service Auto margin:
        //   service items → cost = 0, margin = line_total
        //   part items    → margin = line_total - qty × the item's own frozen purchase_price
        //                    (captured at creation time — NOT a live join to stocks, which
        //                    breaks once the stock lot's price is later cleared/changed/consumed)
        $serviceMargin = function (string $start, ?string $end = null): float {
            $q = DB::table('service_items')
                ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
                ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
                ->selectRaw("SUM(CASE
                    WHEN service_items.item_type = 'service'
                        THEN service_items.line_total
                    ELSE service_items.line_total - service_items.quantity * service_items.purchase_price
                END) as margin");

            $end
                ? $q->whereBetween('service_orders.date', [$start, $end])
                : $q->whereDate('service_orders.date', $start);

            return round((float) ($q->value('margin') ?? 0), 2);
        };

        $marginServiceToday = $serviceMargin($today);
        $marginServiceMonth = $serviceMargin($monthStart, $monthEnd);
        $marginServiceYear = $serviceMargin($yearStart, $yearEnd);

        $mapCommercials = function ($rows): array {
            return $rows->map(function ($item) {
                $totalSales = (float) $item->total_sales;
                $totalMargin = (float) $item->total_margin;
                $totalTyres = (int) $item->total_tyres;

                return [
                    'commercial_name' => $item->commercial_name ?? 'Non assigné',
                    'total_sales' => round($totalSales, 2),
                    'total_tyres' => $totalTyres,
                    'total_margin' => round($totalMargin, 2),
                    'total_unpaid' => round((float) $item->total_unpaid, 2),
                    'avg_margin_per_tyre' => $totalTyres > 0 ? round($totalMargin / $totalTyres, 2) : 0,
                    'margin_rate' => $totalSales > 0 ? round(($totalMargin / $totalSales) * 100, 1) : 0,
                ];
            })->toArray();
        };

        $mapServiceCommercials = function ($rows): array {
            return collect($rows)->map(function ($item) {
                $ca = (float) ($item->so_ca ?? 0);
                $margin = (float) ($item->so_margin ?? 0);

                return [
                    'commercial_name' => $item->commercial_name ?? 'Non assigné',
                    'total_ca' => round($ca, 2),
                    'total_orders' => (int) ($item->so_count ?? 0),
                    'total_margin' => round($margin, 2),
                    'total_unpaid' => round((float) ($item->so_unpaid ?? 0), 2),
                    'margin_rate' => $ca > 0 ? round(($margin / $ca) * 100, 1) : 0,
                ];
            })->sortByDesc(fn ($r) => $r['total_ca'])->values()->toArray();
        };

        $saleNonPaye = SalePaymentStatus::NON_PAYE->value;
        $salePartiel = SalePaymentStatus::PARTIEL->value;
        $soNonPaye = $saleNonPaye;
        $soPartiel = $salePartiel;

        $commercialSelectRaw = "COALESCE(users.name, 'Non assigné') as commercial_name,
            SUM(sales.total_sale) as total_sales,
            COALESCE(SUM(tyre_items.tyre_qty), 0) as total_tyres,
            SUM(sales.margin) as total_margin,
            SUM(CASE WHEN sales.payment_status IN ('$saleNonPaye', '$salePartiel')
                THEN sales.total_sale - COALESCE((SELECT SUM(spa.amount) FROM sale_payment_allocations spa WHERE spa.sale_id = sales.id), 0)
                ELSE 0 END) as total_unpaid";

        // Service-order aggregation per commercial (margin: service lines cost=0, part lines cost from the item's own frozen purchase_price)
        $soCommercialRaw = "COALESCE(users.name, 'Non assigné') as commercial_name,
            COUNT(service_orders.id) as so_count,
            SUM(service_orders.net_amount) as so_ca,
            SUM((
                SELECT COALESCE(SUM(CASE
                    WHEN si.item_type = 'service' THEN si.line_total
                    ELSE si.line_total - si.quantity * si.purchase_price
                END), 0)
                FROM service_items si
                WHERE si.service_order_id = service_orders.id
            )) as so_margin,
            SUM(CASE WHEN service_orders.payment_status IN ('$soNonPaye', '$soPartiel')
                THEN service_orders.net_amount - COALESCE((
                    SELECT SUM(sp.amount) FROM service_payments sp
                    WHERE sp.service_order_id = service_orders.id
                ), 0)
                ELSE 0 END) as so_unpaid";

        $soByMonth = DB::table('service_orders')
            ->leftJoin('users', 'service_orders.commercial_id', '=', 'users.id')
            ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
            ->whereBetween('service_orders.date', [$monthStart, $monthEnd])
            ->selectRaw($soCommercialRaw)
            ->groupBy('service_orders.commercial_id', 'users.name')
            ->get();

        $soByYear = DB::table('service_orders')
            ->leftJoin('users', 'service_orders.commercial_id', '=', 'users.id')
            ->where('service_orders.status', '!=', ServiceOrderStatus::ANNULE->value)
            ->whereBetween('service_orders.date', [$yearStart, $yearEnd])
            ->selectRaw($soCommercialRaw)
            ->groupBy('service_orders.commercial_id', 'users.name')
            ->get();

        $rawSalesMonth = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->where('sales.status', '!=', $saleAnnule)
            ->whereBetween('sales.date', [$monthStart, $monthEnd])
            ->selectRaw($commercialSelectRaw)
            ->groupBy('sales.commercial_id', 'users.name')
            ->get();

        $rawSalesYear = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->where('sales.status', '!=', $saleAnnule)
            ->whereBetween('sales.date', [$yearStart, $yearEnd])
            ->selectRaw($commercialSelectRaw)
            ->groupBy('sales.commercial_id', 'users.name')
            ->get();

        $salesByCommercial = $mapCommercials($rawSalesMonth);
        $salesByCommercialYear = $mapCommercials($rawSalesYear);
        $serviceByCommercial = $mapServiceCommercials($soByMonth);
        $serviceByCommercialYear = $mapServiceCommercials($soByYear);

        $salesTodayAmount = round((clone $salesToday)->sum('total_sale'), 2);
        $marginSalesToday = round((clone $salesToday)->sum('margin'), 2);
        $salesMonthAmount = round((clone $salesMonth)->sum('total_sale'), 2);
        $marginSalesMonth = round((clone $salesMonth)->sum('margin'), 2);
        $salesYearAmount = round((clone $salesYear)->sum('total_sale'), 2);
        $marginSalesYear = round((clone $salesYear)->sum('margin'), 2);

        return response()->json([
            // Today
            'sales_today_amount' => $salesTodayAmount + $caServiceToday + $otherRevenueToday,
            'tyres_today' => $tyreSalesQty($today),
            'margin_today' => $marginSalesToday + $marginServiceToday + $otherRevenueToday,
            'net_margin_today' => $marginSalesToday + $marginServiceToday + $otherRevenueToday - $expensesToday,
            'purchases_today_amount' => round((clone $purchasesToday)->sum(DB::raw('total_price - returned_amount')), 2),
            'tyres_purchased_today' => $tyrePurchaseQty($today, $today),
            'expenses_today' => $expensesToday,
            'other_revenue_today' => $otherRevenueToday,

            // This month
            'sales_month_amount' => $salesMonthAmount + $caServiceMonth + $otherRevenueMonth,
            'purchases_month_amount' => round((clone $purchasesMonth)->sum(DB::raw('total_price - returned_amount')), 2),
            'margin_month' => $marginSalesMonth + $marginServiceMonth + $otherRevenueMonth,
            'net_margin_month' => $marginSalesMonth + $marginServiceMonth + $otherRevenueMonth - $expensesMonth,
            'expenses_month' => $expensesMonth,
            'other_revenue_month' => $otherRevenueMonth,
            'margin_year' => $marginSalesYear + $marginServiceYear + $otherRevenueYear,
            'net_margin_year' => $marginSalesYear + $marginServiceYear + $otherRevenueYear - $expensesYear,
            'expenses_year' => $expensesYear,
            'other_revenue_year' => $otherRevenueYear,
            'total_sale_year' => $salesYearAmount + $caServiceYear + $otherRevenueYear,
            'total_purchase_year' => round((clone $purchasesYear)->sum(DB::raw('total_price - returned_amount')), 2),
            'tyres_month' => $tyreSalesQty($monthStart, $monthEnd),
            'parts_month' => $partsSoldQty($monthStart, $monthEnd),
            'tyres_year' => $tyreSalesQty($yearStart, $yearEnd),
            'parts_year' => $partsSoldQty($yearStart, $yearEnd),
            'tyres_purchased_month' => $tyrePurchaseQty($monthStart, $monthEnd),
            'parts_purchased_month' => $partsPurchasedQty($monthStart, $monthEnd),
            'tyres_purchased_year' => $tyrePurchaseQty($yearStart, $yearEnd),
            'parts_purchased_year' => $partsPurchasedQty($yearStart, $yearEnd),

            // Sales by Commercial
            'sales_by_commercial' => $salesByCommercial,
            'sales_by_commercial_year' => $salesByCommercialYear,
            'service_by_commercial' => $serviceByCommercial,
            'service_by_commercial_year' => $serviceByCommercialYear,

            // Stock
            'stock_quantity' => (int) Stock::sum('quantity'),
            'stock_value' => round(
                (float) (Stock::selectRaw('SUM(quantity * purchase_price) as t')->value('t') ?? 0),
                2
            ),

            // Receivables / payables
            'unpaid_sales' => round(Sale::where('payment_status', SalePaymentStatus::NON_PAYE->value)->where('status', '!=', $saleAnnule)->sum('total_sale'), 2),
            'unpaid_purchases' => $unpaidSuppliers['total'],

            // Solde de caisse — cash accounts only (excludes future-dated Chèque/Effet)
            'cash_balance' => round(
                Account::where('type', 'cash')->get()->sum('current_balance'),
                2
            ),
        ]);
    }
}
