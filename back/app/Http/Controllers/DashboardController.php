<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Aggregated KPI snapshot for the admin dashboard.
     */
    public function kpi(Request $request): JsonResponse
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

        $salesToday = Sale::whereDate('date', $today);
        $purchasesToday = Purchase::whereDate('date', $today);
        $salesMonth = Sale::whereBetween('date', [$monthStart, $monthEnd]);
        $salesYear = Sale::whereBetween('date', [$yearStart, $yearEnd]);
        $purchasesMonth = Purchase::whereBetween('date', [$monthStart, $monthEnd]);
        $purchasesYear = Purchase::whereBetween('date', [$yearStart, $yearEnd]);

        $tyreSalesQty = function (string $start, ?string $end = null): int {
            $q = DB::table('sale_items')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('products.type', 'tyre');
            $end ? $q->whereBetween('sales.date', [$start, $end]) : $q->whereDate('sales.date', $start);

            return (int) $q->sum('sale_items.quantity');
        };

        $tyrePurchaseQty = fn (string $start, string $end): int => (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', 'tyre')
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');

        $purchasesTotalLifetime = (float) Purchase::sum('total_price');
        $purchasesPaidLifetime = (float) Purchase::where('payment_status', 'PAYE')->sum('total_price');

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

        $salesByCommercial = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.date', [$monthStart, $monthEnd])
            ->selectRaw("users.name as commercial_name, SUM(sales.total_sale) as total_sales, COALESCE(SUM(tyre_items.tyre_qty), 0) as total_tyres, SUM(sales.margin) as total_margin, SUM(CASE WHEN sales.payment_status IN ('NON PAYE', 'NON PAYÉ', 'PARTIEL') THEN sales.total_sale - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = sales.id), 0) ELSE 0 END) as total_unpaid")
            ->groupBy('sales.commercial_id', 'users.name')
            ->orderByDesc('total_sales')
            ->get()
            ->map(function ($item) {
                return [
                    'commercial_name' => $item->commercial_name ?? 'Non assigné',
                    'total_sales' => round((float) $item->total_sales, 2),
                    'total_tyres' => (int) $item->total_tyres,
                    'total_margin' => round((float) $item->total_margin, 2),
                    'total_unpaid' => round((float) $item->total_unpaid, 2),
                ];
            })
            ->toArray();

        return response()->json([
            // Today
            'sales_today_amount' => round((clone $salesToday)->sum('total_sale'), 2),
            'tyres_today' => $tyreSalesQty($today),
            'margin_today' => round((clone $salesToday)->sum('margin'), 2),
            'net_margin_today' => round((clone $salesToday)->sum('margin'), 2) - $expensesToday,
            'purchases_today_amount' => round((clone $purchasesToday)->sum('total_price'), 2),
            'tyres_purchased_today' => $tyrePurchaseQty($today, $today),
            'expenses_today' => $expensesToday,

            // This month
            'sales_month_amount' => round((clone $salesMonth)->sum('total_sale'), 2),
            'purchases_month_amount' => round((clone $purchasesMonth)->sum('total_price'), 2),
            'margin_month' => round((clone $salesMonth)->sum('margin'), 2),
            'net_margin_month' => round((clone $salesMonth)->sum('margin'), 2) - $expensesMonth,
            'expenses_month' => $expensesMonth,
            'margin_year' => round((clone $salesYear)->sum('margin'), 2),
            'net_margin_year' => round((clone $salesYear)->sum('margin'), 2) - $expensesYear,
            'expenses_year' => $expensesYear,
            'total_sale_year' => round((clone $salesYear)->sum('total_sale'), 2),
            'total_purchase_year' => round((clone $purchasesYear)->sum('total_price'), 2),
            'tyres_month' => $tyreSalesQty($monthStart, $monthEnd),
            'tyres_year' => $tyreSalesQty($yearStart, $yearEnd),
            'tyres_purchased_month' => $tyrePurchaseQty($monthStart, $monthEnd),
            'tyres_purchased_year' => $tyrePurchaseQty($yearStart, $yearEnd),

            // Sales by Commercial (This Month)
            'sales_by_commercial' => $salesByCommercial,

            // Stock
            'stock_quantity' => (int) Stock::sum('quantity'),
            'stock_value' => round(
                (float) (Stock::selectRaw('SUM(quantity * purchase_price) as t')->value('t') ?? 0),
                2
            ),

            // Receivables / payables
            'unpaid_sales' => round(Sale::where('payment_status', 'NON PAYE')->sum('total_sale'), 2),
            'unpaid_purchases' => round($purchasesTotalLifetime - $purchasesPaidLifetime, 2),

            // Solde de caisse — cash accounts only (excludes future-dated Chèque/Effet)
            'cash_balance' => round(
                Account::where('type', 'cash')->get()->sum('current_balance'),
                2
            ),
        ]);
    }
}
