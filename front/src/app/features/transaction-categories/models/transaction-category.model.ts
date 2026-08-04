export type TransactionCategoryType = 'income' | 'expense';

export interface TransactionCategory {
  id: number;
  name: string;
  type: TransactionCategoryType;
  parent_id: number | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  children?: TransactionCategory[];
}

export interface TransactionCategoryPayload {
  name: string;
  type: TransactionCategoryType;
  parent_id?: number | null;
  sort_order?: number;
}
