<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Aggregated KPI snapshot for the admin dashboard.
     */
    public function kpi(): JsonResponse
    {
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();
        $monthEnd = now()->endOfMonth()->toDateString();
        $yearStart = now()->startOfYear()->toDateString();
        $yearEnd = now()->endOfYear()->toDateString();

        $salesToday = Sale::whereDate('date', $today);
        $salesMonth = Sale::whereBetween('date', [$monthStart, $monthEnd]);
        $salesYear = Sale::whereBetween('date', [$yearStart, $yearEnd]);
        $purchasesMonth = Purchase::whereBetween('date', [$monthStart, $monthEnd]);
        $purchasesYear = Purchase::whereBetween('date', [$yearStart, $yearEnd]);

        $purchasesTotalLifetime = (float) Purchase::sum('total_price');
        $purchasesPaidLifetime = (float) Purchase::where('payment_status', 'PAYE')->sum('total_price');

        $salesByCommercial = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->whereBetween('sales.date', [$monthStart, $monthEnd])
            ->selectRaw('users.name as commercial_name, SUM(sales.total_sale) as total_sales, SUM(sales.total_quantity) as total_tyres, SUM(sales.margin) as total_margin')
            ->groupBy('sales.commercial_id', 'users.name')
            ->orderByDesc('total_sales')
            ->get()
            ->map(function ($item) {
                return [
                    'commercial_name' => $item->commercial_name ?? 'Non assigné',
                    'total_sales' => round((float) $item->total_sales, 2),
                    'total_tyres' => (int) $item->total_tyres,
                    'total_margin' => round((float) $item->total_margin, 2),
                ];
            })
            ->toArray();

        return response()->json([
            // Today
            'sales_today_amount' => round((clone $salesToday)->sum('total_sale'), 2),
            'tyres_today' => (int) (clone $salesToday)->sum('total_quantity'),
            'margin_today' => round((clone $salesToday)->sum('margin'), 2),

            // This month
            'sales_month_amount' => round((clone $salesMonth)->sum('total_sale'), 2),
            'purchases_month_amount' => round((clone $purchasesMonth)->sum('total_price'), 2),
            'margin_month' => round((clone $salesMonth)->sum('margin'), 2),
            'margin_year' => round((clone $salesYear)->sum('margin'), 2),
            'total_sale_year' => round((clone $salesYear)->sum('total_sale'), 2),
            'total_purchase_year' => round((clone $purchasesYear)->sum('total_price'), 2),
            'tyres_month' => (int) (clone $salesMonth)->sum('total_quantity'),
            'tyres_year' => (int) (clone $salesYear)->sum('total_quantity'),

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

            // Cash flow lifetime balance
            'cash_balance' => round(
                Transaction::where('type', 'income')->sum('amount')
                - Transaction::where('type', 'expense')->sum('amount'),
                2
            ),
        ]);
    }
}
