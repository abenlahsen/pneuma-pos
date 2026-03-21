export interface Carrier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CarrierPayload extends Omit<Carrier, 'id' | 'created_at' | 'updated_at'> {}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}
