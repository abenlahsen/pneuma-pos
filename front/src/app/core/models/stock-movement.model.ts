export type StockMovementType =
  | 'AUTO_CREATE'
  | 'INITIAL'
  | 'IMPORT'
  | 'ADJUSTMENT'
  | 'DELETION'
  | 'SALE_OUT'
  | 'SALE_IN'
  | 'PURCHASE_IN'
  | 'PURCHASE_OUT';

export interface StockMovement {
  id: number;
  stock_id: number | null;
  product_id: number | null;
  type: StockMovementType;
  quantity_before: number;
  quantity_after: number;
  delta: number;
  reference_type: string | null;
  reference_id: number | null;
  reason: string | null;
  user_id: number | null;
  user?: { id: number; name: string } | null;
  stock?: { id: number; depot: string | null; zone: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovementFilters {
  stock_id?: number;
  product_id?: number;
  type?: StockMovementType;
  user_id?: number;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}
