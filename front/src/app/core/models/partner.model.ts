export interface Partner {
  id: number;
  name: string;
  city?: string;
  phone?: string;
  montage_price?: number;
  alignment_price?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PartnerPayload extends Omit<Partner, 'id' | 'created_at' | 'updated_at'> {}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}
