import { Product } from '../../../core/models/product.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Stock } from '../../../core/models/stock.model';
import { PurchaseStatus, PaymentStatus } from '../../../core/constants/status.constants';

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
  /** Running totals maintained by supplier returns (see PurchaseReturn) — gross value, undiscounted. */
  returned_quantity?: number;
  returned_amount?: number;
  items?: PurchaseItem[];
  status: PurchaseStatus;
  payment_status: PaymentStatus;
  /** Distinct methods of the payments actually recorded against this purchase (derived, read-only). */
  payment_methods?: string[];
  payments?: PurchasePayment[];
  supplier?: Supplier;
  commercial?: { id: number; name: string } | null;
  creator?: { id: number; name: string } | null;
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
  unpaid_en_cours: number;
  unpaid_recu_termine: number;
  ca_avec_facture: number;
  ca_sans_facture: number;
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
  payment_status: PaymentStatus;
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

// -----------------------------------------------------------------------------
// Purchase Returns (retours fournisseur)
// -----------------------------------------------------------------------------

export interface PurchaseReturnItem {
  id: number;
  purchase_return_id: number;
  purchase_item_id: number;
  product_id: number | null;
  stock_id: number | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
  linkedProduct?: Product;
}

export interface PurchaseReturn {
  id: number;
  purchase_id: number;
  date: string;
  reason?: string | null;
  total_quantity: number;
  total_amount: number;
  refund_amount: number;
  refund_transaction_id?: number | null;
  items?: PurchaseReturnItem[];
  refundTransaction?: { id: number; account?: { id: number; name: string } | null } | null;
  creator?: { id: number; name: string } | null;
  created_at?: string;
}

export interface PurchaseReturnRefundPayload {
  amount: number;
  account_id: number;
  date: string;
  method: string;
}

export interface PurchaseReturnPayload {
  date: string;
  reason?: string | null;
  items: { purchase_item_id: number; quantity: number }[];
  refund?: PurchaseReturnRefundPayload | null;
}
