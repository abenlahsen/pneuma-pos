export interface ServiceItem {
  id?: number;
  service_order_id?: number;
  service_type: string;
  description?: string | null;
  parts_cost: number;
  labor_cost: number;
  line_total?: number;
  sort_order?: number;
}

export interface ServiceOrder {
  id: number;
  date: string;
  client: string;
  phone?: string | null;
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
  service_type: string;
  description?: string | null;
  parts_cost: number;
  labor_cost: number;
  sort_order?: number;
}

export interface ServiceOrderPayload {
  date: string;
  client: string;
  phone?: string | null;
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
  reference?: string | null;
  notes?: string | null;
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
  service_types: string[];
  commercials: { id: number; name: string }[];
}
