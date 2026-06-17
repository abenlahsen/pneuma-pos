export interface CommercialKpi {
  commercial_name: string;
  total_sales?: number;
  total_tyres?: number;
  total_margin?: number;
  total_unpaid?: number;
  avg_margin_per_tyre?: number;
  margin_rate?: number;
  total_ca?: number;
  total_orders?: number;
}

export interface DashboardKpi {
  // Today
  sales_today_amount: number;
  tyres_today: number;
  margin_today: number;
  net_margin_today: number;
  purchases_today_amount: number;
  tyres_purchased_today: number;
  expenses_today: number;

  // Month
  sales_month_amount: number;
  purchases_month_amount: number;
  margin_month: number;
  net_margin_month: number;
  expenses_month: number;
  tyres_month: number;
  parts_month: number;
  tyres_purchased_month: number;
  parts_purchased_month: number;

  // Year
  margin_year: number;
  net_margin_year: number;
  expenses_year: number;
  total_sale_year: number;
  total_purchase_year: number;
  tyres_year: number;
  parts_year: number;
  tyres_purchased_year: number;
  parts_purchased_year: number;

  // By commercial
  sales_by_commercial: CommercialKpi[];
  sales_by_commercial_year: CommercialKpi[];
  service_by_commercial: CommercialKpi[];
  service_by_commercial_year: CommercialKpi[];

  // Stock & cash
  stock_quantity: number;
  stock_value: number;
  unpaid_sales: number;
  unpaid_purchases: number;
  cash_balance: number;
}

export interface KpiSnapshot {
  id: number;
  snapshot_date: string;
  data: DashboardKpi;
  created_at: string;
}

export interface KpiHistoryMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface KpiHistoryResponse {
  data: KpiSnapshot[];
  meta: KpiHistoryMeta;
}
