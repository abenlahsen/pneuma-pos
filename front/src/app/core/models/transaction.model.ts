export interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  method: string | null;
  description: string;
  person: string | null;
  partner: string | null;
  user_id: number;
  account_id: number;
  transfer_id: string | null;
  account?: { id: number, name: string, type: string };
  created_at: string;
  updated_at: string;
}

export interface TransactionPayload {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  method?: string;
  description: string;
  person?: string;
  partner?: string;
  account_id: number;
}

export interface TransactionSummary {
  income: number;
  expenses: number;
  balance: number;
  pending_income: number;
  pending_expense: number;
}

export interface TransactionFilters {
  categories: string[];
  persons: string[];
  partners: string[];
  accounts: { id: number, name: string, type: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
