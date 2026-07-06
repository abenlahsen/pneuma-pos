export interface Payment {
  id: number;
  sale_id: number;
  transaction_id: number | null;
  amount: number;
  date: string;
  method: string;
  reference: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
  /** True when this payment was split across several sales (settled from the client page). */
  multi?: boolean;
}

export interface PaymentPayload {
  amount: number;
  date: string;
  method: string;
  reference?: string;
  notes?: string;
  account_id: number;
}

export interface PaymentSummary {
  payments: Payment[];
  total_paid: number;
  total_sale: number;
  remaining: number;
  payment_status: string;
}

export interface PaymentDetailSaleRow {
  id: number;
  date?: string;
  total_sale: number;
  status: string;
  payment_status: string;
  allocated_amount: number;
}

export interface PaymentDetail {
  id: number;
  date: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
  client?: { id: number; name: string } | null;
  account?: { id: number; name: string } | null;
  sales: PaymentDetailSaleRow[];
}
