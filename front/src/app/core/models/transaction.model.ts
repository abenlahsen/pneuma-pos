export interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  description: string;
  person: string | null;
  partner: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionPayload {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  description: string;
  person?: string;
  partner?: string;
}

export interface TransactionSummary {
  income: number;
  expenses: number;
  balance: number;
}

export interface TransactionFilters {
  categories: string[];
  persons: string[];
  partners: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
