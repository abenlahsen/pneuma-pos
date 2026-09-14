export interface ReportPeriod {
  year: number;
  month: number;
  start: string;
  end: string;
  quarter: number;
  label: string;
}

export interface ReportSales {
  total: number;
  with_invoice: number;
  without_invoice: number;
  count: number;
  avg_basket: number;
  gross_margin: number;
  tyres_qty: number;
  parts_qty: number;
  avg_price_per_tyre: number;
  unpaid_generated: number;
}

export interface ReportPurchases {
  total: number;
  with_invoice: number;
  without_invoice: number;
  count: number;
  tyres_qty: number;
  parts_qty: number;
  returns_count: number;
  returns_amount: number;
  refunds_received: number;
  unpaid_generated: number;
}

export interface ReportServiceOrders {
  revenue: number;
  count: number;
  gross_margin: number;
  collected: number;
  tyres_qty: number;
}

export interface ReportMargin {
  sales: number;
  service: number;
  other_revenue: number;
  gross: number;
  rate: number;
  expenses: number;
  net: number;
}

export interface ReportPaymentSplit {
  total: number;
  with_invoice: number;
  without_invoice: number;
  unallocated: number;
  by_method: Record<string, number>;
}

export interface ReportCollections extends ReportPaymentSplit {
  service_orders: number;
}

export interface ReportExpenseCategory {
  category: string;
  amount: number;
  share: number;
}

export interface ReportExpenses {
  total: number;
  by_category: ReportExpenseCategory[];
}

export interface ReportPayroll {
  total: number;
  by_subcategory: Record<string, number>;
  employee_count: number;
}

export interface ReportCashFlow {
  income_settled: number;
  expense_settled: number;
  net: number;
  pending_income: number;
  pending_expense: number;
}

export interface ReportCommercial {
  commercial_name: string;
  sales_count: number;
  total_sales: number;
  total_tyres: number;
  total_margin: number;
  margin_rate: number;
  total_unpaid: number;
}

export interface ReportBrand {
  brand: string;
  tyres_qty: number;
  share_pct: number;
  total_sales: number;
  margin: number;
}

export interface ReportPeriodData {
  sales: ReportSales;
  purchases: ReportPurchases;
  service_orders: ReportServiceOrders;
  margin: ReportMargin;
  collections: ReportCollections;
  supplier_payments: ReportPaymentSplit;
  expenses: ReportExpenses;
  payroll: ReportPayroll;
  cash_flow: ReportCashFlow;
  commercials: ReportCommercial[];
  top_brands: ReportBrand[];
  clients: { new_count: number };

  /** Les cinq cadrans de `3h`. */
  kpi: {
    revenue: number;
    gross_margin: number;
    basket: number;
    /** Ordre de grandeur : la valeur de stock n'est pas historisee. */
    stock_turns: number;
    unpaid: number;
  };
}

/** Un mois de la serie unique : CA, et le meme mois un an plus tot. */
export interface ReportSeriesPoint {
  month: string;
  label: string;
  revenue: number;
  previous_revenue: number;
}

export interface MonthlyReport {
  granularity: 'month' | 'quarter' | 'year';
  period: ReportPeriod;
  previous_period: ReportPeriod;
  current: ReportPeriodData;
  previous: ReportPeriodData;
  series: ReportSeriesPoint[];
}
