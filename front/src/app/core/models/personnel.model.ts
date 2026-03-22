export interface Personnel {
  id: number;
  name: string;
  role: 'Commercial' | 'Chauffeur' | 'Technicien';
  phone?: string;
  email?: string;
  commission_rate?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelPayload {
  name: string;
  role: 'Commercial' | 'Chauffeur' | 'Technicien';
  phone?: string;
  email?: string;
  commission_rate?: number;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  per_page: number;
  total: number;
}
