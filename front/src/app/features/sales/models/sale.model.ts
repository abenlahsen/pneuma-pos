import { Product } from '../../../core/models/product.model';
import { Stock } from '../../../core/models/stock.model';
import { Client } from '../../clients/models/client.model';

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  stock_id?: number | null;
  quantity: number;
  purchase_price?: number;
  selling_price?: number;
  unit_price?: number;
  discount?: number;
  total_purchase?: number;
  total_sale?: number;
  total?: number;
  subtotal?: number;
  margin?: number;
  product_name?: string | null;
  linkedProduct?: Product;
  linked_product?: Product;
  product?: Product | null;
  stock?: Stock | null;
}

export interface SaleClientAccountSummary {
  sales_count?: number;
  total_purchased?: number;
  last_sale_date?: string | null;
  outstanding_balance?: number;
  credit_limit?: number | null;
  opening_balance?: number | null;
  payment_terms_days?: number | null;
  default_payment_method?: string | null;
}

export interface Sale {
  id: number;
  date: string;
  with_invoice: boolean;
  total_quantity?: number;
  total_purchase?: number;
  total_sale?: number;
  margin?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paid_amount?: number;
  due_amount?: number;
  amount_paid?: number;
  remaining_amount?: number;
  sale_number?: string | null;
  invoice_number?: string | null;
  items?: SaleItem[];

  city?: string | null;
  carrier_id: number | null;
  carrier?: { id: number; name: string } | null;
  tracking_number: string;
  partner_id: number | null;
  partner?: { id: number; name: string; city?: string; montage_price?: number; alignment_price?: number } | null;
  service: string;
  client_id?: number | null;
  linked_client?: Client | null;
  client_summary?: SaleClientAccountSummary | null;
  client: string;
  client_phone: string;
  payment_method: string;
  commercial_id?: number | null;
  commercial?: { id: number; name: string } | null;
  status: string;
  payment_status: string;
  delivery_date: string;
  comments: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SalePayload extends Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'items' | 'linked_client' | 'client_summary'> {
  items: SaleItem[];
}

export interface SaleSummary {
  tyres_this_month: number;
  tyres_today: number;
  tyres_en_cours: number;
  sales_en_cours: number;
  unpaid_en_cours: number;
  unpaid_livre_monte: number;
  ca_avec_facture: number;
  ca_sans_facture: number;
}

export interface SaleFilters {
  brands: string[];
  clients: string[];
  cities: string[];
  statuses: string[];
  payment_statuses: string[];
  carriers: { id: number; name: string }[];
  partners: { id: number; name: string }[];
  commercials: { id: number; name: string }[];
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
