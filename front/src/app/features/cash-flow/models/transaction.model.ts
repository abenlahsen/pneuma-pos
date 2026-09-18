export interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  subcategory: string | null;
  method: string | null;
  description: string;
  person: string | null;
  partner_id: number | null;
  partner?: { id: number; name: string } | null;
  user_id: number;
  account_id: number;
  transfer_id: string | null;
  account?: { id: number; name: string; type: string };
  /** Set when this transaction settles a purchase payment — id to fetch its detail via PurchaseService.getPaymentDetail(). */
  purchase_payment_id: number | null;
  /** Set when this transaction settles a sale payment — id to fetch its detail via PaymentService.getPaymentDetail(). */
  sale_payment_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionPayload {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  subcategory?: string | null;
  method?: string;
  description: string;
  person?: string;
  partner_id?: number | null;
  account_id: number;
}

export interface TransactionSummary {
  income: number;
  expenses: number;
  balance: number;
  pending_income: number;
  pending_expense: number;
}

export interface TransactionFilters {
  categories: string[];
  persons: string[];
  partners: { id: number; name: string }[];
  accounts: { id: number; name: string; type: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Refonte 2b — projection de trésorerie à 6 semaines. Voir CashFlowProjectionService (back). */
export interface CashFlowProjectionWeek {
  start: string;
  end: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
}

export interface CashFlowProjectionLowPoint {
  label: string;
  start: string;
  balance: number;
}

export interface CashFlowInPlay {
  supplier_due: number;
  client_due: number;
  net_position: number;
}

export interface CashFlowExpenseByCategory {
  category: string;
  amount: number;
}

export interface CashFlowProjection {
  today_balance: number;
  weeks: CashFlowProjectionWeek[];
  low_point: CashFlowProjectionLowPoint | null;
  in_play: CashFlowInPlay;
  expenses_by_category: CashFlowExpenseByCategory[];
  recurring_weekly_estimate: number;
}
