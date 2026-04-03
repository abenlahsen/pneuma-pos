import { Product } from './product.model';

export interface Stock {
  id: number;
  product_id: number | null;
  product?: Product;
  made_in: string | null;
  dot: string | null;
  depot: string | null;
  zone: string | null;
  quantity: number;
  purchase_price: number | null;
  user_id: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockPayload {
  product_id: number;
  made_in?: string | null;
  dot?: string | null;
  depot?: string | null;
  zone?: string | null;
  quantity: number;
  purchase_price?: number | null;
}

export interface StockSummary {
  total_articles: number;
  total_quantity: number;
  total_purchase_value: number;
  total_selling_value: number;
}

export interface StockFilters {
  brands: string[];
  depots: string[];
  zones: string[];
  countries: string[];
}

export interface ParsedDimension {
  width: number | null;
  height: number | null;
  diameter: number | null;
  text: string[];
}
