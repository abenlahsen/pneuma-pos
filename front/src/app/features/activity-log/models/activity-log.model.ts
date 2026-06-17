export interface ActivityLogSnapshot {
  id?: number;
  date?: string;
  status?: string;
  payment_status?: string;
  total_sale?: number;
  total_purchase?: number;
  total_quantity?: number;
  margin?: number;
  net_amount?: number;
  total_amount?: number;
  payment_method?: string;
  with_invoice?: boolean;
  discount?: number;
  client?: string;
  commercial?: string;
  carrier?: string;
  partner?: string;
  supplier?: string;
  vehicle?: string;
  mileage?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface ActivityLogProperties {
  before?: ActivityLogSnapshot | null;
  after?: ActivityLogSnapshot | null;
  amount?: number;
  method?: string;
  reference?: string | null;
}

export interface ActivityLog {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT_ADD' | 'PAYMENT_DELETE';
  entity_type: 'vente' | 'achat' | 'service_order';
  entity_id: number;
  entity_label: string;
  description: string;
  properties: ActivityLogProperties | null;
  user_id: number | null;
  user_name: string | null;
  user?: { id: number; name: string } | null;
  created_at: string;
}

export interface ActivityLogFilters {
  entityTypes: string[];
  actions: string[];
  users: { id: number; name: string }[];
}

export interface ActivityLogParams {
  entity_type?: string;
  action?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}
