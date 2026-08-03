export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierPayload extends Omit<Supplier, 'id' | 'created_at' | 'updated_at'> {}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}

export interface PurchaseHistoryRow {
  id: number;
  supplier_id?: number;
  date?: string;
  total_price?: number;
  discount?: number;
  net_amount?: number;
  total_quantity?: number;
  status?: string;
  payment_status?: string;
  paid_amount?: number;
  outstanding_amount?: number;
  created_at?: string;
}

export interface SupplierStatementEntry {
  type: string;
  date?: string;
  description?: string;
  purchase_id?: number;
  payment_id?: number;
  debit: number;
  credit: number;
  balance: number;
}

export interface SupplierStatementPayment {
  id: number;
  purchase_id?: number;
  reference?: string;
  date?: string;
  amount?: number;
  method?: string;
  notes?: string;
  created_at?: string;
  /** True when the parent payment is split across several purchases. */
  multi?: boolean;
}

export interface SupplierProfileResponse {
  supplier: Supplier;
  purchases_count: number;
  total_purchased: number;
  last_purchase_date?: string | null;
  outstanding_balance: number;
  purchases: PurchaseHistoryRow[];
}

export interface SupplierStatementSummary {
  purchases_count: number;
  payments_count: number;
  total_purchased: number;
  total_paid: number;
  outstanding_balance: number;
  last_purchase_date?: string | null;
}

export interface SupplierStatementResponse {
  supplier: Supplier;
  summary: SupplierStatementSummary;
  purchases: PurchaseHistoryRow[];
  payments: SupplierStatementPayment[];
  entries: SupplierStatementEntry[];
}

export interface UnpaidPurchaseRow {
  id: number;
  date?: string;
  net_amount: number;
  paid_amount: number;
  remaining: number;
  with_invoice: boolean;
}

export interface SupplierPaymentAllocationInput {
  purchase_id: number;
  amount: number;
}

export interface SupplierPaymentPayload {
  amount: number;
  method: string;
  date: string;
  account_id: number;
  reference?: string | null;
  notes?: string | null;
  allocations: SupplierPaymentAllocationInput[];
}