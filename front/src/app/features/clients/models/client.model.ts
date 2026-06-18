import { Vehicle } from '../../vehicles/models/vehicle.model';
import { ClientCategory } from '../../../core/constants/status.constants';

export interface Client {
  id: number;
  name: string;
  category?: ClientCategory | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  credit_limit?: number | null;
  opening_balance?: number | null;
  payment_terms_days?: number | null;
  default_payment_method?: string | null;
  vehicles?: Vehicle[];
  vehicles_count?: number;
}

export interface ClientPayload {
  name: string;
  category?: ClientCategory | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  credit_limit?: number | null;
  opening_balance?: number | null;
  payment_terms_days?: number | null;
  default_payment_method?: string | null;
}

export interface ClientFilters {
  search?: string;
  name?: string;
  phone?: string;
  city?: string;
  category?: string;
  is_active?: boolean | null;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  per_page?: number;
}

export interface ClientListResponse {
  data: Client[];
  total?: number;
  current_page?: number;
  last_page?: number;
  per_page?: number;
}

export interface ClientDuplicateCheckResponse {
  matches: Client[];
  total: number;
}

export interface ClientSalesHistoryRow {
  id: number;
  sale_date?: string | null;
  created_at?: string | null;
  reference?: string | null;
  invoice_number?: string | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  balance_due?: number | null;
  status?: string | null;
  payment_status?: string | null;
  client?: string | null;
  client_phone?: string | null;
}

export interface ClientPaymentRow {
  id: number;
  payment_date?: string | null;
  created_at?: string | null;
  amount?: number | null;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  sale_id?: number | null;
}

export interface ClientStatementSummary {
  total_purchased?: number | null;
  total_paid?: number | null;
  outstanding_balance?: number | null;
  opening_balance?: number | null;
  credit_limit?: number | null;
  last_sale_date?: string | null;
}

export interface ClientStatementEntry {
  id?: number | string | null;
  type?: string | null;
  date?: string | null;
  reference?: string | null;
  description?: string | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  amount?: number | null;
  sale_id?: number | null;
  payment_id?: number | null;
  status?: string | null;
}

export interface ClientProfileResponse {
  client: Client;
  sales_count: number;
  total_purchased: number;
  last_sale_date?: string | null;
  outstanding_balance: number;
  sales?: ClientSalesHistoryRow[];
  sales_history?: ClientSalesHistoryRow[];
  summary?: ClientStatementSummary | null;
}

export interface ClientStatementResponse {
  client: Client;
  summary: ClientStatementSummary;
  sales: ClientSalesHistoryRow[];
  payments: ClientPaymentRow[];
  entries: ClientStatementEntry[];
}
