export interface Sale {
  id: number;
  date: string;
  with_invoice: boolean;
  quantity: number;
  dimension: string;
  ic: string;
  iv: string;
  rft: string;
  brand: string;
  profile: string;
  purchase_price: number;
  total_purchase: number;
  selling_price: number;
  total_sale: number;
  margin: number;
  supplier_id: number | null;
  supplier?: { id: number; name: string };
  city: string;
  carrier_id: number | null;
  carrier?: { id: number; name: string };
  tracking_number: string;
  partner_id: number | null;
  partner?: { id: number; name: string; city?: string; montage_price?: number; alignment_price?: number };
  service: string;
  service_fee: number;
  client: string;
  payment_method: string;
  commercial_id?: number | null;
  status: string;
  payment_status: string;
  delivery_date: string;
  comments: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalePayload extends Omit<Sale, 'id' | 'created_at' | 'updated_at'> {}

export interface SaleSummary {
  total_purchase: number;
  total_sale: number;
  margin: number;
}

export interface SaleFilters {
  brands: string[];
  clients: string[];
  cities: string[];
  statuses: string[];
  payment_statuses: string[];
  partners: string[];
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}
