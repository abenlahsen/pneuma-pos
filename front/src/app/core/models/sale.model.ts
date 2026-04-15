import { Product } from './product.model';
import { Stock } from './stock.model';

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  stock_id: number;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  discount?: number;
  total_purchase?: number;
  total_sale?: number;
  margin?: number;
  linkedProduct?: Product;
  linked_product?: Product;
  stock?: Stock;
}
export interface Sale {
  id: number;
  date: string;
  with_invoice: boolean;
  total_quantity?: number;
  total_purchase?: number;
  total_sale?: number;
  margin?: number;
  items?: SaleItem[];

  city: string;
  carrier_id: number | null;
  carrier?: { id: number; name: string };
  tracking_number: string;
  partner_id: number | null;
  partner?: { id: number; name: string; city?: string; montage_price?: number; alignment_price?: number };
  service: string;
  client: string;
  client_phone: string;
  payment_method: string;
  commercial_id?: number | null;
  commercial?: { id: number; name: string } | null;
  status: string;
  payment_status: string;
  delivery_date: string;
  comments: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalePayload extends Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'items'> {
  items: SaleItem[];
}

export interface SaleSummary {
  tyres_this_month: number;
  tyres_today: number;
  tyres_en_cours: number;
  sales_en_cours: number;
  total_unpaid: number;
}

export interface SaleFilters {
  brands: string[];
  clients: string[];
  cities: string[];
  statuses: string[];
  payment_statuses: string[];
  partners: string[];
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
