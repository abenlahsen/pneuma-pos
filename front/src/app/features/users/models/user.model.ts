import { Role } from '../../roles/models/role.model';

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  commission_rate: number | null;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  password_confirmation?: string;
  phone?: string;
  commission_rate?: number;
  role?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}