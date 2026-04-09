<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Stock;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;

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

        $salesToday = Sale::whereDate('date', $today);
        $salesMonth = Sale::whereBetween('date', [$monthStart, $monthEnd]);
        $purchasesMonth = Purchase::whereBetween('date', [$monthStart, $monthEnd]);

        $purchasesTotalLifetime = (float) Purchase::sum('total_price');
        $purchasesPaidLifetime = (float) Purchase::where('payment_status', 'PAYE')->sum('total_price');

        return response()->json([
            // Today
            'sales_today_amount' => round((clone $salesToday)->sum('total_sale'), 2),
            'tyres_today' => (int) (clone $salesToday)->sum('total_quantity'),

            // This month
            'sales_month_amount' => round((clone $salesMonth)->sum('total_sale'), 2),
            'purchases_month_amount' => round((clone $purchasesMonth)->sum('total_price'), 2),
            'margin_month' => round((clone $salesMonth)->sum('margin'), 2),
            'tyres_month' => (int) (clone $salesMonth)->sum('total_quantity'),

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
