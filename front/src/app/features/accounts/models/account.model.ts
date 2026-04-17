export interface Account {
  id: number;
  name: string;
  type: 'cash' | 'bank' | 'person';
  description: string | null;
  initial_balance: number;
  current_balance: number;
  expected_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountPayload {
  name: string;
  type: 'cash' | 'bank' | 'person';
  description?: string;
  initial_balance?: number;
  is_active?: boolean;
}

export interface TransferPayload {
  source_account_id: number;
  destination_account_id: number;
  amount: number;
  date: string;
  description?: string;
}