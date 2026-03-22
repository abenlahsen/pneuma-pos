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
}

export interface PaymentPayload {
  amount: number;
  date: string;
  method: string;
  reference?: string;
  notes?: string;
}

export interface PaymentSummary {
  payments: Payment[];
  total_paid: number;
  total_sale: number;
  remaining: number;
  payment_status: string;
}
