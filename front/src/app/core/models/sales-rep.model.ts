export interface SalesRep {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  commission_rate?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SalesRepPayload extends Omit<SalesRep, 'id' | 'created_at' | 'updated_at'> {}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}
