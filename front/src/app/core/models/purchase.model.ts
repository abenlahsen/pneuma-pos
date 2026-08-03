import { Product } from './product.model';
import { Supplier } from './supplier.model';
import { Stock } from './stock.model';
import { PurchaseStatus, PaymentStatus } from '../constants/status.constants';

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
  bl_number?: string | null;
  invoice_number?: string | null;
  total_quantity?: number;
  total_price?: number;
  discount?: number;
  net_amount?: number;
  items?: PurchaseItem[];
  status: PurchaseStatus;
  payment_status: PaymentStatus;
  /** Distinct methods of the payments actually recorded against this purchase (derived, read-only). */
  payment_methods?: string[];
  payments?: PurchasePayment[];
  supplier?: Supplier;
  commercial?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface PurchasePayload {
  date: string;
  with_invoice: boolean;
  bl_number?: string | null;
  invoice_number?: string | null;
  discount?: number;
  supplier_id: number;
  commercial_id?: number | null;
  status: PurchaseStatus;
  payment_status: PaymentStatus;
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
  /** True when this payment was split across several purchases (settled from the supplier page). */
  multi?: boolean;
}

export interface PurchasePaymentSummary {
  payments: PurchasePayment[];
  total_paid: number;
  total_purchase: number;
  remaining: number;
  payment_status: string;
}

export interface PurchasePaymentDetailPurchaseRow {
  id: number;
  date?: string;
  net_amount: number;
  status: string;
  payment_status: string;
  allocated_amount: number;
}

export interface PurchasePaymentDetail {
  id: number;
  date: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string;
  supplier?: { id: number; name: string } | null;
  account?: { id: number; name: string } | null;
  purchases: PurchasePaymentDetailPurchaseRow[];
}
