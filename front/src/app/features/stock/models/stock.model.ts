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
  /** Repères ajoutés par la refonte 2b (voir StockService::summary côté back). */
  references_count?: number;
  depots_count?: number;
  low_stock_count?: number;
  zero_count?: number;
  dormant_days?: number;
  dormant_count?: number;
  dormant_value?: number;
  coverage_days?: number | null;
}

/** Refonte 2b — une ligne par référence, ses lots dépliables en dessous. */
export interface StockLot {
  id: number;
  dot: string | null;
  made_in: string | null;
  depot: string | null;
  zone: string | null;
  quantity: number;
  purchase_price: number;
  value: number;
}

export interface StockDepotSplit {
  depot: string;
  quantity: number;
}

export interface StockGroup {
  product_id: number;
  dimension: string | null;
  brand: string | null;
  profile: string | null;
  reference: string | null;
  load_index: string | null;
  speed_index: string | null;
  season: string | null;
  runflat: boolean;
  marking: string | null;
  quantity: number;
  value: number;
  unit_price: number | null;
  lots_count: number;
  by_depot: StockDepotSplit[];
  sold_30d: number;
  sold_180d: number;
  lots: StockLot[];
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
