export interface Carrier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  /**
   * Ventes livrées par ce transporteur. Absent quand l'API ne l'a pas compté —
   * `undefined` veut dire « on ne sait pas », pas « aucune ».
   */
  sales_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CarrierPayload extends Omit<Carrier, 'id' | 'created_at' | 'updated_at' | 'sales_count'> {}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}