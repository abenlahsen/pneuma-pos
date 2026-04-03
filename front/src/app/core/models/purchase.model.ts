import { Product } from './product.model';
import { Supplier } from './supplier.model';
export interface Purchase {
  id: number;
  date: string;
  product: string;
  product_id: number | null;
  stock_id: number | null;
  linked_product?: Product;
  supplier_id: number;
  commercial_id?: number | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
  status: 'EN COURS' | 'RECU' | 'ANNULE' | 'RETOUR';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
  supplier?: Supplier;
  commercial?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface PurchasePayload {
  date: string;
  product: string;
  product_id: number;
  stock_id: number | null;
  supplier_id: number;
  commercial_id?: number | null;
  quantity: number;
  unit_price: number;
  status: 'EN COURS' | 'RECU' | 'ANNULE' | 'RETOUR';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
}

export interface PurchaseSummary {
  total_achats: number;
  total_paye: number;
  reste_a_payer: number;
}

export interface PurchasePayment {
  id: number;
  purchase_id: number;
  amount: number;
  date: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface PurchasePaymentSummary {
  payments: PurchasePayment[];
  total_paid: number;
  total_purchase: number;
  remaining: number;
  payment_status: string;
}
