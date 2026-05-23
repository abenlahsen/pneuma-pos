import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Stock } from '../../../core/models/stock.model';

export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  product_id: number;
  stock_id: number;
  quantity: number;
  unit_price: number;
  total_price?: number;
  linkedProduct?: Product;
  linked_product?: Product;
  stock?: Stock;
}

export interface Purchase {
  id: number;
  date: string;
  with_invoice: boolean;
  total_quantity?: number;
  total_price?: number;
  discount?: number;
  net_amount?: number;
  items?: PurchaseItem[];
  status: 'EN COURS' | 'RECU' | 'TERMINE' | 'ANNULE' | 'RETOUR';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
  payment_method?: string;
  supplier?: Supplier;
  commercial?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface PurchasePayload {
  date: string;
  with_invoice: boolean;
  discount?: number;
  supplier_id: number;
  commercial_id?: number | null;
  status: 'EN COURS' | 'RECU' | 'TERMINE' | 'ANNULE' | 'RETOUR';
  payment_status: 'PAYE' | 'NON PAYE' | 'PARTIEL';
  items: PurchaseItem[];
}

export interface PurchaseSummary {
  total_achats: number;
  total_paye: number;
  reste_a_payer: number;
}

export interface PurchasePayment {
  id: number;
  purchase_id: number;
  transaction_id: string | number | null;
  amount: number;
  date: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  account_id: number;
  created_at?: string;
}

export interface PurchasePaymentSummary {
  payments: PurchasePayment[];
  total_paid: number;
  total_purchase: number;
  remaining: number;
  payment_status: string;
}
