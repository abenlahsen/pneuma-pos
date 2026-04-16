export interface Brand {
  id: number;
  name: string;
  logo: string | null;
  is_active: boolean;
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