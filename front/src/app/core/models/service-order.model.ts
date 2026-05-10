export interface ServiceItem {
  id?: number;
  service_order_id?: number;
  product_id: number;
  product?: {
    id: number;
    profile: string | null;
    reference: string | null;
    selling_price?: number | null;
  } | null;
  description?: string | null;
  parts_cost: number;
  labor_cost: number;
  line_total?: number;
  sort_order?: number;
}

export interface ServiceOrder {
  id: number;
  client_id?: number | null;
  client_record?: { id: number; name: string; phone?: string | null } | null;
  date: string;
  vehicle: string;
  mileage?: number | null;
  items?: ServiceItem[];
  total_amount: number;
  discount: number;
  net_amount: number;
  status: 'EN COURS' | 'TERMINE' | 'ANNULE';
  payment_status: 'NON PAYE' | 'PARTIEL' | 'PAYE';
  notes?: string | null;
  commercial_id?: number | null;
  commercial?: { id: number; name: string } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ServiceItemPayload {
  product_id: number;
  description?: string | null;
  parts_cost: number;
  labor_cost: number;
  sort_order?: number;
}

export interface ServiceOrderPayload {
  client_id?: number | null;
  date: string;
  vehicle: string;
  mileage?: number | null;
  items: ServiceItemPayload[];
  discount: number;
  status?: string;
  payment_status?: string;
  notes?: string | null;
  commercial_id?: number | null;
}

export interface ServicePayment {
  id: number;
  service_order_id: number;
  amount: number;
  date: string;
  method?: string | null;
  account_id?: number | null;
  account?: { id: number; name: string; type: string } | null;
  reference?: string | null;
  notes?: string | null;
  transaction?: { account?: { id: number; name: string } | null } | null;
  transaction_id?: number | null;
  user_id?: number | null;
  created_at?: string | null;
}

export interface ServicePaymentPayload {
  amount: number;
  date: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  account_id?: number | null;
}

export interface ServiceOrderSummary {
  total_revenue: number;
  total_paid: number;
  remaining: number;
}

export interface ServiceOrderFilters {
  service_products: { id: number; profile: string | null; reference: string | null }[];
  commercials: { id: number; name: string }[];
  clients: { id: number; name: string; phone?: string | null }[];
  accounts: { id: number; name: string; type: string }[];
}
