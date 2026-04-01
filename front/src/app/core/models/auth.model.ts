export interface UserRole {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  phone: string | null;
  commission_rate: number | null;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  permissions: string[];
  token: string;
  must_change_password?: boolean;
}

export interface UserResponse {
  user: User;
  permissions: string[];
  must_change_password?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

