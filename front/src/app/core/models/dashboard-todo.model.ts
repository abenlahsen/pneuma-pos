/** Refonte 2b — Accueil : la liste « à traiter ». Voir DashboardTodoService (back). */

export interface TodoUnpaidSaleRow {
  id: number;
  client_id: number | null;
  client_name: string;
  date: string;
  city: string | null;
  commercial: string | null;
  days: number;
  amount: number;
}

export interface TodoUnpaidPurchaseRow {
  id: number;
  supplier_id: number | null;
  supplier_name: string;
  date: string;
  with_invoice: boolean;
  days: number;
  amount: number;
}

export interface TodoServiceOrderRow {
  id: number;
  plate: string | null;
  vehicle: string | null;
  client_name: string | null;
  commercial: string | null;
  items_count: number;
  days: number;
  amount: number;
}

export interface TodoLowStockRow {
  id: number;
  name: string | null;
  reference: string | null;
  dimension: string | null;
  remaining: number;
  sold_30d: number;
}

export interface TodoGroup<T> {
  count: number;
  total?: number;
  rows: T[];
}

export interface TodoUnpaidPurchaseGroup extends TodoGroup<TodoUnpaidPurchaseRow> {
  old_debt_days: number;
  old_debt_count: number;
}

export interface DashboardTodo {
  unpaid_sales: TodoGroup<TodoUnpaidSaleRow> | null;
  unpaid_purchases: TodoUnpaidPurchaseGroup | null;
  to_invoice: TodoGroup<TodoServiceOrderRow> | null;
  low_stock: TodoGroup<TodoLowStockRow> | null;
  collected_today: number | null;
  sales_last_30_days: { date: string; amount: number }[] | null;
}
