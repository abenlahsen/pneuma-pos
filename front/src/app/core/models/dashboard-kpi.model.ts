export interface DashboardKpi {
  sales_today_amount: number;
  tyres_today: number;
  margin_today: number;
  net_margin_today: number;
  purchases_today_amount: number;
  tyres_purchased_today: number;
  expenses_today: number;
  expenses_month: number;
  expenses_year: number;
  other_revenue_today: number;
  other_revenue_month: number;
  other_revenue_year: number;
  sales_month_amount: number;
  purchases_month_amount: number;
  margin_month: number;
  net_margin_month: number;
  margin_year: number;
  net_margin_year: number;
  total_sale_year: number;
  total_purchase_year: number;
  tyres_month: number;
  parts_month: number;
  tyres_year: number;
  parts_year: number;
  tyres_purchased_month: number;
  parts_purchased_month: number;
  tyres_purchased_year: number;
  parts_purchased_year: number;
  stock_quantity: number;
  stock_value: number;
  unpaid_sales: number;
  unpaid_purchases: number;
  cash_balance: number;
  sales_by_commercial: CommercialPerf[];
  sales_by_commercial_year: CommercialPerf[];
  service_by_commercial: ServiceCommercialPerf[];
  service_by_commercial_year: ServiceCommercialPerf[];
}

export interface ServiceCommercialPerf {
  commercial_name: string;
  total_ca: number;
  total_orders: number;
  total_margin: number;
  total_unpaid: number;
  margin_rate: number;
}

export interface CommercialPerf {
  commercial_name: string;
  total_sales: number;
  total_tyres: number;
  total_margin: number;
  total_unpaid: number;
  avg_margin_per_tyre: number;
  margin_rate: number;
}
