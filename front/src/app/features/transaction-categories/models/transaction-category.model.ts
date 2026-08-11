export type TransactionCategoryType = 'income' | 'expense';

export interface TransactionCategory {
  id: number;
  name: string;
  type: TransactionCategoryType;
  parent_id: number | null;
  is_system: boolean;
  is_active: boolean;
  counts_as_expense: boolean;
  counts_as_revenue: boolean;
  is_confidential: boolean;
  sort_order: number;
  children?: TransactionCategory[];
}

export interface TransactionCategoryPayload {
  name: string;
  type: TransactionCategoryType;
  parent_id?: number | null;
  sort_order?: number;
  counts_as_expense?: boolean;
  counts_as_revenue?: boolean;
  is_confidential?: boolean;
}
