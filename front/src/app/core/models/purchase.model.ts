import { Supplier } from './supplier.model';
import { Personnel } from './personnel.model';

export interface Purchase {
  id: number;
  date: string;
  product: string;
  supplier_id: number;
  commercial_id?: number | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
  status: 'EN COURS' | 'RECU';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
  payment_method?: 'Espèces' | 'Virement' | 'Chèque' | null;
  payment_date?: string | null;
  supplier?: Supplier;
  commercial?: Personnel;
  created_at?: string;
  updated_at?: string;
}

export interface PurchasePayload {
  date: string;
  product: string;
  supplier_id: number;
  commercial_id?: number | null;
  quantity: number;
  unit_price: number;
  status: 'EN COURS' | 'RECU';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
  payment_method?: 'Espèces' | 'Virement' | 'Chèque' | null;
  payment_date?: string | null;
}

export interface PurchaseSummary {
  total_achats: number;
  total_paye: number;
  reste_a_payer: number;
}
