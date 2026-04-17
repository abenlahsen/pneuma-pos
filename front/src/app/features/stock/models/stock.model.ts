import { Product } from '../../../core/models/product.model';

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
  reason?: string | null;
}

export interface StockSummary {
  total_articles: number;
  total_quantity: number;
  total_purchase_value: number;
}

export interface StockMovement {
  id: number;
  stock_id: number | null;
  product_id: number | null;
  type: string;
  user_id: number | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  quantity_change?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: number;
    name: string;
  } | null;
  stock?: {
    id: number;
    depot: string | null;
    zone: string | null;
  } | null;
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
