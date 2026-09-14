import { Product } from '../../../core/models/product.model';

export interface ProductStockLot {
  id: number;
  depot: string | null;
  zone: string | null;
  dot: string | null;
  made_in: string | null;
  quantity: number;
  purchase_price: number;
}

export interface ProductStockState {
  quantity: number;
  threshold: number;
  /**
   * Toujours 0 aujourd'hui : le stock est decremente a la creation de la vente,
   * donc ce qui reste EST le disponible. Le champ existe pour que le bandeau de
   * la fiche (`3e`) calcule sans changer de forme le jour ou une reservation
   * existera.
   */
  reserved: number;
  available: number;
  below_threshold: boolean;
  lots: ProductStockLot[];
}

export interface ProductMargin {
  purchase_price: number;
  selling_price: number;
  margin: number;
  margin_pct: number;
}

export interface ProductHistoryPoint {
  month: string;
  quantity: number;
}

export interface ProductMovement {
  id: number;
  type: string;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  created_at: string;
  depot: string | null;
}

export interface ProductPriceRow {
  sale_id: number;
  date: string;
  quantity: number;
  selling_price: number;
  discount: number | null;
}

export interface ProductSupplierRow {
  id: number;
  name: string;
  purchases: number;
  last_date: string | null;
  avg_price: number;
}

/** `GET /api/products/{id}/profile` — fiche produit `3e`. */
export interface ProductProfile {
  product: Product;
  stock: ProductStockState;
  margin: ProductMargin;
  history: ProductHistoryPoint[];
  movements: ProductMovement[];
  prices: ProductPriceRow[];
  suppliers: ProductSupplierRow[];
}
