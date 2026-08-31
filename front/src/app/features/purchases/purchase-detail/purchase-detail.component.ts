import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Purchase } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';
import { paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { AuthService } from '../../../core/services/auth.service';
// Return-related calls live only on this (features/purchases) copy of PurchaseService —
// the core/services copy this component otherwise has no need for is not extended with them.
import { PurchaseService as PurchaseReturnsService } from '../data-access/purchase.service';
import { PurchaseReturn } from '../models/purchase.model';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, ProductDetailComponent, DocumentPrintComponent],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['../../sales/sale-detail/sale-detail.component.scss', './purchase-detail.component.scss']
})
export class PurchaseDetailComponent implements OnInit {
  @Input({ required: true }) purchase!: Purchase;
  @Input() canEdit = false;
  @Input() canReturn = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() openReturn = new EventEmitter<void>();
  /** Emitted after a return is deleted here — the parent's purchase list and this
   *  modal's own (now stale) status/payment_status/returned_amount need a refresh. */
  @Output() returnsChanged = new EventEmitter<void>();

  viewingProduct = signal<Product | null>(null);
  printDoc = signal<PrintDocument | null>(null);
  returns = signal<PurchaseReturn[]>([]);
  loadingReturns = signal(false);
  readonly paymentMethodClass = paymentMethodClass;

  // Constructor injection (not inject()) so this component can still be
  // instantiated directly with plain mocks in specs, matching the rest of
  // this codebase's no-TestBed convention (see purchase-detail.component.spec.ts).
  constructor(
    private returnsService: PurchaseReturnsService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.loadingReturns.set(true);
    this.returnsService.getReturns(this.purchase.id).subscribe({
      next: (data) => {
        this.returns.set(data);
        this.loadingReturns.set(false);
      },
      error: () => this.loadingReturns.set(false),
    });
  }

  deleteReturn(purchaseReturn: PurchaseReturn): void {
    if (!confirm('Supprimer ce retour ? Le stock sera restauré.')) return;
    this.returnsService.deleteReturn(purchaseReturn.id).subscribe({
      next: () => {
        this.loadReturns();
        this.returnsChanged.emit();
      },
      error: () => alert('Erreur lors de la suppression du retour.'),
    });
  }

  openPrint(): void {
    const lines: PrintLine[] = (this.purchase.items || []).map(item => {
      const product = this.getProduct(item);
      return {
        label: this.printLabel(product, `Produit #${item.product_id}`),
        reference: this.printReference(product),
        details: this.printDetails(product),
        qty: item.quantity,
        unit_price: Number(item.unit_price ?? 0),
        discount: 0,
        total: Number(item.unit_price ?? 0) * Number(item.quantity),
      };
    });

    this.printDoc.set({
      type: 'purchase',
      doc_number: String(this.purchase.id),
      date: this.purchase.date,
      party_label: 'Fournisseur',
      party_name: this.purchase.supplier?.name || '-',
      party_phone: this.purchase.supplier?.phone || null,
      lines,
      total_ht: Number(this.purchase.total_price ?? 0),
      discount_global: Number(this.purchase.discount ?? 0),
      net_amount: Number(this.purchase.net_amount ?? this.purchase.total_price ?? 0),
      status: this.purchase.status,
      payment_status: this.purchase.payment_status,
      commercial: this.purchase.commercial?.name || null,
    });
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  private printLabel(product: any, fallback: string): string {
    if (product?.type !== 'tyre') return product?.reference || fallback;
    const parts: string[] = [];
    if (product.brand?.name) parts.push(product.brand.name);
    if (product.profile) parts.push(product.profile);
    return parts.join(' ') || product?.reference || fallback;
  }

  private printReference(product: any): string | undefined {
    if (product?.type !== 'tyre') return product?.profile || undefined;
    const t = product?.tyre;
    if (t?.tire_width && t?.tire_height && t?.tire_diameter) {
      return `${t.tire_width}/${t.tire_height}R${t.tire_diameter}`;
    }
    return undefined;
  }

  private printDetails(product: any): string | undefined {
    if (product?.type !== 'tyre') return undefined;
    const t = product?.tyre;
    if (!t) return undefined;
    const parts: string[] = [];
    if (t.tire_load_index) parts.push(t.tire_load_index);
    if (t.tire_speed_index) parts.push(t.tire_speed_index);
    if (t.tire_marking) parts.push(t.tire_marking);
    return parts.length ? parts.join(' · ') : undefined;
  }

  openProductView(item: any): void {
    const product = this.getProduct(item);
    if (product) {
      this.viewingProduct.set(product);
    }
  }

  editProductInNewTab(product: Product): void {
    this.viewingProduct.set(null);
    window.open(`/products?id=${product.id}&edit=1`, '_blank', 'noopener');
  }
}
