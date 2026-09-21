export interface Brand {
  id: number;
  name: string;
  logo: string | null;
  is_active: boolean;
  /**
   * Produits portant cette marque. Absent quand l'API ne l'a pas compté —
   * `undefined` veut dire « on ne sait pas », pas « aucun ».
   */
  products_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BrandPayload {
  name: string;
  logo?: string | null;
  is_active?: boolean;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
}