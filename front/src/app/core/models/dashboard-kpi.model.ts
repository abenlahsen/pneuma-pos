export interface DashboardKpi {
  sales_today_amount: number;
  tyres_today: number;
  sales_month_amount: number;
  purchases_month_amount: number;
  margin_month: number;
  margin_year: number;
  total_sale_year: number;
  total_purchase_year: number;
  tyres_month: number;
  stock_quantity: number;
  stock_value: number;
  unpaid_sales: number;
  unpaid_purchases: number;
  cash_balance: number;
  sales_by_commercial: {
    commercial_name: string;
    total_sales: number;
    sales_count: number;
    total_margin: number;
  }[];
}
