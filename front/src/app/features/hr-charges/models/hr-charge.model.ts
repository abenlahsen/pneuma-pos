export interface HrCharge {
  id: number;
  date: string;
  employee_id: number | null;
  employee_name: string | null;
  subcategory: string | null;
  amount: number;
  method: string;
  description: string | null;
  account?: { id: number; name: string };
}

export interface HrChargeListResponse {
  data: HrCharge[];
  total: number;
}

export interface HrChargeSummary {
  total: number;
  by_subcategory: Record<string, number>;
  employee_count: number;
}

export interface HrEmployee {
  id: number;
  name: string;
  // Decimal columns are cast to a formatted string by the backend (e.g. "6500.00").
  salary: string | number | null;
  prime_per_tyre: string | number | null;
}

export interface HrSubcategory {
  id: number;
  name: string;
}

export interface HrAccount {
  id: number;
  name: string;
  type: string;
}

export interface HrChargeFilters {
  employees: HrEmployee[];
  subcategories: HrSubcategory[];
  accounts: HrAccount[];
}

export interface HrChargeLinePayload {
  employee_id: number | null;
  date: string;
  subcategory: string;
  amount: number | null;
  account_id: number | null;
  method: string;
  description?: string | null;
}

export interface HrChargeBatchPayload {
  lines: HrChargeLinePayload[];
}

export interface HrChargeUpdatePayload {
  employee_id?: number;
  date?: string;
  subcategory?: string;
  amount?: number;
  account_id?: number;
  method?: string;
  description?: string | null;
}
