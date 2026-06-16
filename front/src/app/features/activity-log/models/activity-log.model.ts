export interface ActivityLog {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT_ADD' | 'PAYMENT_DELETE';
  entity_type: 'vente' | 'achat' | 'service_order';
  entity_id: number;
  entity_label: string;
  description: string;
  properties: Record<string, unknown> | null;
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
