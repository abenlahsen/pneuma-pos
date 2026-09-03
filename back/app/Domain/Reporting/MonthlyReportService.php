<?php

namespace App\Domain\Reporting;

use App\Domain\Hr\HrChargeService;
use App\Enums\PurchaseStatus;
use App\Enums\SalePaymentStatus;
use App\Enums\SaleStatus;
use App\Enums\ServiceOrderStatus;
use App\Models\Client;
use App\Models\Payment;
use App\Models\PurchasePayment;
use App\Models\ServicePayment;
use App\Models\Transaction;
use App\Models\TransactionCategory;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Month-scoped management report for the Administrator.
 *
 * Every figure is computed for a calendar month [start, end] using the
 * business `date` column of each entity (not created_at), and cancelled
 * sales / purchases / service orders are excluded — the same conventions as
 * DashboardKpiService. The "with / without invoice" split relies on the
 * `with_invoice` flag that only exists on sales and purchases; payments are
 * attributed through the allocation tables so a multi-sale payment is split
 * correctly between invoiced and non-invoiced sales.
 *
 * Deliberately NOT reported: stock value and account balances (point-in-time
 * figures that cannot be back-dated to a past month).
 */
class MonthlyReportService
{
    private const TRANSFER_CATEGORY = 'Transfert';

    public function __construct(private HrChargeService $hrChargeService) {}

    /**
     * @return array{period: array, previous_period: array, current: array, previous: array}
     */
    public function build(int $year, int $month): array
    {
        $current = Carbon::createFromDate($year, $month, 1)->startOfDay();
        $previous = $current->copy()->subMonthNoOverflow();

        return [
            'period' => $this->periodMeta($current),
            'previous_period' => $this->periodMeta($previous),
            'current' => $this->computePeriod($current),
            'previous' => $this->computePeriod($previous),
        ];
    }

    private function periodMeta(Carbon $monthStart): array
    {
        return [
            'year' => $monthStart->year,
            'month' => $monthStart->month,
            'start' => $monthStart->toDateString(),
            'end' => $monthStart->copy()->endOfMonth()->toDateString(),
        ];
    }

    private function computePeriod(Carbon $monthStart): array
    {
        $start = $monthStart->toDateString();
        $end = $monthStart->copy()->endOfMonth()->toDateString();

        $sales = $this->salesBlock($start, $end);
        $purchases = $this->purchasesBlock($start, $end);
        $serviceOrders = $this->serviceOrdersBlock($start, $end);
        $expenses = $this->expensesBlock($start, $end);
        $otherRevenue = $this->otherRevenue($start, $end);

        $grossMargin = round($sales['gross_margin'] + $serviceOrders['gross_margin'] + $otherRevenue, 2);
        $revenue = $sales['total'] + $serviceOrders['revenue'] + $otherRevenue;

        return [
            'sales' => $sales,
            'purchases' => $purchases,
            'service_orders' => $serviceOrders,
            'margin' => [
                'sales' => $sales['gross_margin'],
                'service' => $serviceOrders['gross_margin'],
                'other_revenue' => $otherRevenue,
                'gross' => $grossMargin,
                'rate' => $revenue > 0 ? round($grossMargin / $revenue * 100, 1) : 0,
                'expenses' => $expenses['total'],
                'net' => round($grossMargin - $expenses['total'], 2),
            ],
            'collections' => $this->collectionsBlock($start, $end),
            'supplier_payments' => $this->supplierPaymentsBlock($start, $end),
            'expenses' => $expenses,
            'payroll' => $this->hrChargeService->summary($monthStart->year, $monthStart->month),
            'cash_flow' => $this->cashFlowBlock($start, $end),
            'commercials' => $this->commercialsBlock($start, $end),
            'top_brands' => $this->topBrandsBlock($start, $end),
            'clients' => [
                'new_count' => Client::query()
                    ->whereBetween('created_at', [$start.' 00:00:00', $end.' 23:59:59'])
                    ->count(),
            ],
        ];
    }

    // ── Sales ────────────────────────────────────────────────────────────────

    private function salesBlock(string $start, string $end): array
    {
        $annule = SaleStatus::ANNULE->value;
        $nonPaye = SalePaymentStatus::NON_PAYE->value;
        $partiel = SalePaymentStatus::PARTIEL->value;

        // Raw builder on purpose: Sale has accessors (`total`, `subtotal`, …)
        // that would shadow same-named SQL aliases on an Eloquent result.
        $base = DB::table('sales')
            ->whereBetween('date', [$start, $end])
            ->where('status', '!=', $annule);

        $byInvoice = (clone $base)
            ->selectRaw('with_invoice, COUNT(*) as cnt, SUM(total_sale) as total, SUM(margin) as margin')
            ->groupBy('with_invoice')
            ->get()
            ->keyBy(fn ($row) => (int) $row->with_invoice);

        $unpaid = (clone $base)
            ->whereIn('payment_status', [$nonPaye, $partiel])
            ->selectRaw('SUM(GREATEST(total_sale - COALESCE((
                SELECT SUM(spa.amount) FROM sale_payment_allocations spa WHERE spa.sale_id = sales.id
            ), 0), 0)) as unpaid')
            ->value('unpaid');

        $tyres = $this->saleItemsByType('tyre', $start, $end);
        $parts = $this->saleItemsByType('part', $start, $end);

        $withInvoice = round((float) ($byInvoice->get(1)->total ?? 0), 2);
        $withoutInvoice = round((float) ($byInvoice->get(0)->total ?? 0), 2);
        $count = (int) $byInvoice->sum('cnt');
        $total = round($withInvoice + $withoutInvoice, 2);

        return [
            'total' => $total,
            'with_invoice' => $withInvoice,
            'without_invoice' => $withoutInvoice,
            'count' => $count,
            'avg_basket' => $count > 0 ? round($total / $count, 2) : 0,
            'gross_margin' => round((float) $byInvoice->sum('margin'), 2),
            'tyres_qty' => $tyres['qty'],
            'parts_qty' => $parts['qty'],
            'avg_price_per_tyre' => $tyres['qty'] > 0 ? round($tyres['amount'] / $tyres['qty'], 2) : 0,
            'unpaid_generated' => round((float) ($unpaid ?? 0), 2),
        ];
    }

    /**
     * @return array{qty: int, amount: float}
     */
    private function saleItemsByType(string $type, string $start, string $end): array
    {
        $row = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('products.type', $type)
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
            ->whereBetween('sales.date', [$start, $end])
            ->selectRaw('COALESCE(SUM(sale_items.quantity), 0) as qty, COALESCE(SUM(sale_items.total_sale), 0) as amount')
            ->first();

        return ['qty' => (int) $row->qty, 'amount' => round((float) $row->amount, 2)];
    }

    // ── Purchases ────────────────────────────────────────────────────────────

    private function purchasesBlock(string $start, string $end): array
    {
        $annule = PurchaseStatus::ANNULE->value;

        // Net cost of goods actually kept: net_amount after the purchase-level
        // discount, minus returned goods scaled by that same discount (see
        // Purchase::effectiveNetAmount()).
        $effectiveNet = 'GREATEST(net_amount - returned_amount * (1 - discount / 100), 0)';

        $base = DB::table('purchases')
            ->whereBetween('date', [$start, $end])
            ->where('status', '!=', $annule);

        $byInvoice = (clone $base)
            ->selectRaw("with_invoice, COUNT(*) as cnt, SUM({$effectiveNet}) as total")
            ->groupBy('with_invoice')
            ->get()
            ->keyBy(fn ($row) => (int) $row->with_invoice);

        $unpaid = (clone $base)
            ->selectRaw("SUM(GREATEST({$effectiveNet} - (
                COALESCE((SELECT SUM(ppa.amount) FROM purchase_payment_allocations ppa WHERE ppa.purchase_id = purchases.id), 0)
                - COALESCE((SELECT SUM(pr.refund_amount) FROM purchase_returns pr WHERE pr.purchase_id = purchases.id), 0)
            ), 0)) as unpaid")
            ->value('unpaid');

        $returns = DB::table('purchase_returns')
            ->join('purchases', 'purchase_returns.purchase_id', '=', 'purchases.id')
            ->whereBetween('purchase_returns.date', [$start, $end])
            ->selectRaw('COUNT(*) as cnt,
                COALESCE(SUM(purchase_returns.total_amount * (1 - purchases.discount / 100)), 0) as amount,
                COALESCE(SUM(purchase_returns.refund_amount), 0) as refunded')
            ->first();

        $withInvoice = round((float) ($byInvoice->get(1)->total ?? 0), 2);
        $withoutInvoice = round((float) ($byInvoice->get(0)->total ?? 0), 2);

        return [
            'total' => round($withInvoice + $withoutInvoice, 2),
            'with_invoice' => $withInvoice,
            'without_invoice' => $withoutInvoice,
            'count' => (int) $byInvoice->sum('cnt'),
            'tyres_qty' => $this->purchaseItemsQty('tyre', $start, $end),
            'parts_qty' => $this->purchaseItemsQty('part', $start, $end),
            'returns_count' => (int) $returns->cnt,
            'returns_amount' => round((float) $returns->amount, 2),
            'refunds_received' => round((float) $returns->refunded, 2),
            'unpaid_generated' => round((float) ($unpaid ?? 0), 2),
        ];
    }

    private function purchaseItemsQty(string $type, string $start, string $end): int
    {
        return (int) DB::table('purchase_items')
            ->join('products', 'purchase_items.product_id', '=', 'products.id')
            ->join('purchases', 'purchase_items.purchase_id', '=', 'purchases.id')
            ->where('products.type', $type)
            ->where('purchases.status', '!=', PurchaseStatus::ANNULE->value)
            ->whereBetween('purchases.date', [$start, $end])
            ->sum('purchase_items.quantity');
    }

    // ── Service Auto ─────────────────────────────────────────────────────────

    private function serviceOrdersBlock(string $start, string $end): array
    {
        $annule = ServiceOrderStatus::ANNULE->value;

        $header = DB::table('service_orders')
            ->whereBetween('date', [$start, $end])
            ->where('status', '!=', $annule)
            ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(net_amount), 0) as revenue')
            ->first();

        // Service lines are pure labour (cost 0); part lines carry the frozen
        // purchase price at the time of the order — same formula as the dashboard.
        $margin = DB::table('service_items')
            ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
            ->where('service_orders.status', '!=', $annule)
            ->whereBetween('service_orders.date', [$start, $end])
            ->selectRaw("COALESCE(SUM(CASE
                WHEN service_items.item_type = 'service' THEN service_items.line_total
                ELSE service_items.line_total - service_items.quantity * service_items.purchase_price
            END), 0) as margin")
            ->value('margin');

        $tyres = DB::table('service_items')
            ->join('products', 'service_items.product_id', '=', 'products.id')
            ->join('service_orders', 'service_items.service_order_id', '=', 'service_orders.id')
            ->where('products.type', 'tyre')
            ->where('service_items.item_type', 'part')
            ->where('service_orders.status', '!=', $annule)
            ->whereBetween('service_orders.date', [$start, $end])
            ->sum('service_items.quantity');

        return [
            'revenue' => round((float) $header->revenue, 2),
            'count' => (int) $header->cnt,
            'gross_margin' => round((float) $margin, 2),
            'collected' => round((float) ServicePayment::query()->whereBetween('date', [$start, $end])->sum('amount'), 2),
            'tyres_qty' => (int) $tyres,
        ];
    }

    // ── Collections / supplier payments ──────────────────────────────────────

    private function collectionsBlock(string $start, string $end): array
    {
        $payments = Payment::query()->whereBetween('date', [$start, $end]);

        $split = DB::table('sale_payment_allocations as spa')
            ->join('payments as p', 'p.id', '=', 'spa.payment_id')
            ->join('sales as s', 's.id', '=', 'spa.sale_id')
            ->whereBetween('p.date', [$start, $end])
            ->selectRaw('s.with_invoice, SUM(spa.amount) as amount')
            ->groupBy('s.with_invoice')
            ->get()
            ->keyBy(fn ($row) => (int) $row->with_invoice);

        return $this->paymentSplit(
            total: (float) (clone $payments)->sum('amount'),
            withInvoice: (float) ($split->get(1)->amount ?? 0),
            withoutInvoice: (float) ($split->get(0)->amount ?? 0),
            byMethod: (clone $payments)->selectRaw('method, SUM(amount) as amount')->groupBy('method')->orderByDesc('amount')->get(),
        ) + [
            'service_orders' => round((float) ServicePayment::query()->whereBetween('date', [$start, $end])->sum('amount'), 2),
        ];
    }

    private function supplierPaymentsBlock(string $start, string $end): array
    {
        $payments = PurchasePayment::query()->whereBetween('date', [$start, $end]);

        $split = DB::table('purchase_payment_allocations as ppa')
            ->join('purchase_payments as pp', 'pp.id', '=', 'ppa.purchase_payment_id')
            ->join('purchases as p', 'p.id', '=', 'ppa.purchase_id')
            ->whereBetween('pp.date', [$start, $end])
            ->selectRaw('p.with_invoice, SUM(ppa.amount) as amount')
            ->groupBy('p.with_invoice')
            ->get()
            ->keyBy(fn ($row) => (int) $row->with_invoice);

        return $this->paymentSplit(
            total: (float) (clone $payments)->sum('amount'),
            withInvoice: (float) ($split->get(1)->amount ?? 0),
            withoutInvoice: (float) ($split->get(0)->amount ?? 0),
            byMethod: (clone $payments)->selectRaw('method, SUM(amount) as amount')->groupBy('method')->orderByDesc('amount')->get(),
        );
    }

    /**
     * @param  Collection<int, object>  $byMethod
     */
    private function paymentSplit(float $total, float $withInvoice, float $withoutInvoice, Collection $byMethod): array
    {
        return [
            'total' => round($total, 2),
            'with_invoice' => round($withInvoice, 2),
            'without_invoice' => round($withoutInvoice, 2),
            // Legacy payments recorded before allocations existed, or payments
            // whose allocations do not cover the full amount.
            'unallocated' => round(max($total - $withInvoice - $withoutInvoice, 0), 2),
            'by_method' => $byMethod
                ->mapWithKeys(fn ($row) => [($row->method ?: 'Non renseigné') => round((float) $row->amount, 2)])
                ->all(),
        ];
    }

    // ── Expenses / other revenue / cash flow ─────────────────────────────────

    private function expensesBlock(string $start, string $end): array
    {
        $rows = Transaction::query()
            ->where('type', 'expense')
            ->whereIn('category', TransactionCategory::expenseKpiNames())
            ->whereBetween('date', [$start, $end])
            ->selectRaw('category, SUM(amount) as amount')
            ->groupBy('category')
            ->orderByDesc('amount')
            ->get();

        $total = round((float) $rows->sum('amount'), 2);

        return [
            'total' => $total,
            'by_category' => $rows->map(fn ($row) => [
                'category' => $row->category,
                'amount' => round((float) $row->amount, 2),
                'share' => $total > 0 ? round((float) $row->amount / $total * 100, 1) : 0,
            ])->values()->all(),
        ];
    }

    private function otherRevenue(string $start, string $end): float
    {
        return round((float) Transaction::query()
            ->where('type', 'income')
            ->whereIn('category', TransactionCategory::revenueKpiNames())
            ->whereBetween('date', [$start, $end])
            ->sum('amount'), 2);
    }

    private function cashFlowBlock(string $start, string $end): array
    {
        // Inter-account transfers are recorded as an income + an expense pair;
        // they move money around without changing the shop's cash position.
        $base = Transaction::query()
            ->whereBetween('date', [$start, $end])
            ->where(fn ($q) => $q->whereNull('category')->orWhere('category', '!=', self::TRANSFER_CATEGORY));

        $income = (float) (clone $base)->settled()->ofType('income')->sum('amount');
        $expense = (float) (clone $base)->settled()->ofType('expense')->sum('amount');

        return [
            'income_settled' => round($income, 2),
            'expense_settled' => round($expense, 2),
            'net' => round($income - $expense, 2),
            'pending_income' => round((float) (clone $base)->pending()->ofType('income')->sum('amount'), 2),
            'pending_expense' => round((float) (clone $base)->pending()->ofType('expense')->sum('amount'), 2),
        ];
    }

    // ── Commercials / brands ─────────────────────────────────────────────────

    private function commercialsBlock(string $start, string $end): array
    {
        $nonPaye = SalePaymentStatus::NON_PAYE->value;
        $partiel = SalePaymentStatus::PARTIEL->value;

        $tyreItemsSub = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->where('products.type', 'tyre')
            ->selectRaw('sale_items.sale_id, SUM(sale_items.quantity) as tyre_qty')
            ->groupBy('sale_items.sale_id');

        $rows = DB::table('sales')
            ->leftJoin('users', 'sales.commercial_id', '=', 'users.id')
            ->leftJoinSub($tyreItemsSub, 'tyre_items', 'tyre_items.sale_id', '=', 'sales.id')
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
            ->whereBetween('sales.date', [$start, $end])
            ->selectRaw("COALESCE(users.name, 'Non assigné') as commercial_name,
                COUNT(sales.id) as sales_count,
                SUM(sales.total_sale) as total_sales,
                COALESCE(SUM(tyre_items.tyre_qty), 0) as total_tyres,
                SUM(sales.margin) as total_margin,
                SUM(CASE WHEN sales.payment_status IN (?, ?)
                    THEN GREATEST(sales.total_sale - COALESCE((SELECT SUM(spa.amount) FROM sale_payment_allocations spa WHERE spa.sale_id = sales.id), 0), 0)
                    ELSE 0 END) as total_unpaid", [$nonPaye, $partiel])
            ->groupBy('sales.commercial_id', 'users.name')
            ->orderByDesc('total_sales')
            ->get();

        return $rows->map(function ($row) {
            $totalSales = round((float) $row->total_sales, 2);
            $totalMargin = round((float) $row->total_margin, 2);

            return [
                'commercial_name' => $row->commercial_name,
                'sales_count' => (int) $row->sales_count,
                'total_sales' => $totalSales,
                'total_tyres' => (int) $row->total_tyres,
                'total_margin' => $totalMargin,
                'margin_rate' => $totalSales > 0 ? round($totalMargin / $totalSales * 100, 1) : 0,
                'total_unpaid' => round((float) $row->total_unpaid, 2),
            ];
        })->values()->all();
    }

    private function topBrandsBlock(string $start, string $end, int $limit = 5): array
    {
        // No SQL LIMIT on purpose: each brand's share is computed against every
        // tyre sold in the period, not only against the brands that make the top list.
        $rows = DB::table('sale_items')
            ->join('products', 'sale_items.product_id', '=', 'products.id')
            ->join('brands', 'products.brand_id', '=', 'brands.id')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('products.type', 'tyre')
            ->where('sales.status', '!=', SaleStatus::ANNULE->value)
            ->whereBetween('sales.date', [$start, $end])
            ->selectRaw('brands.name as brand, SUM(sale_items.quantity) as tyres_qty, SUM(sale_items.total_sale) as total_sales, SUM(sale_items.margin) as margin')
            ->groupBy('brands.id', 'brands.name')
            ->orderByDesc('tyres_qty')
            ->get();

        $totalQty = (int) $rows->sum('tyres_qty');

        return $rows
            ->take($limit)
            ->map(fn ($row) => [
                'brand' => $row->brand,
                'tyres_qty' => (int) $row->tyres_qty,
                'share_pct' => $totalQty > 0 ? round((int) $row->tyres_qty / $totalQty * 100, 1) : 0,
                'total_sales' => round((float) $row->total_sales, 2),
                'margin' => round((float) $row->margin, 2),
            ])
            ->values()
            ->all();
    }
}
