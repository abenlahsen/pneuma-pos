import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Purchase } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, ProductDetailComponent, DocumentPrintComponent],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['../../sales/sale-detail/sale-detail.component.scss', './purchase-detail.component.scss']
})
export class PurchaseDetailComponent {
  @Input({ required: true }) purchase!: Purchase;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  viewingProduct = signal<Product | null>(null);
  printDoc = signal<PrintDocument | null>(null);

  openPrint(): void {
    const lines: PrintLine[] = (this.purchase.items || []).map(item => ({
      label: this.getProduct(item)?.reference || `Produit #${item.product_id}`,
      reference: this.getProduct(item)?.profile || undefined,
      qty: item.quantity,
      unit_price: Number(item.unit_price ?? 0),
      discount: 0,
      total: Number(item.unit_price ?? 0) * Number(item.quantity),
    }));

    this.printDoc.set({
      type: 'purchase',
      doc_number: String(this.purchase.id),
      date: this.purchase.date,
      party_label: 'Fournisseur',
      party_name: this.purchase.supplier?.name || '-',
      party_phone: this.purchase.supplier?.phone || null,
      lines,
      total_ht: Number(this.purchase.total_price ?? 0),
      net_amount: Number(this.purchase.total_price ?? 0),
      status: this.purchase.status,
      payment_status: this.purchase.payment_status,
      commercial: this.purchase.commercial?.name || null,
    });
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
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
