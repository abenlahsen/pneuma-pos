import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule, ProductDetailComponent, DocumentPrintComponent],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.scss'
})
export class SaleDetailComponent {
  @Input({ required: true }) sale!: Sale;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  viewingProduct = signal<Product | null>(null);
  printDoc = signal<PrintDocument | null>(null);

  openPrint(): void {
    const lines: PrintLine[] = (this.sale.items || []).map(item => ({
      label: this.getProduct(item)?.reference
        || item.product_name
        || `Produit #${item.product_id}`,
      reference: this.getProduct(item)?.profile || undefined,
      qty: item.quantity,
      unit_price: Number(item.selling_price ?? item.unit_price ?? 0),
      discount: Number(item.discount || 0),
      total: this.lineTotal(item),
    }));

    this.printDoc.set({
      type: 'sale',
      doc_number: String(this.sale.id),
      date: this.sale.date,
      party_label: 'Client',
      party_name: this.clientName,
      party_phone: this.clientPhone,
      party_city: this.clientCity,
      lines,
      total_ht: Number(this.sale.total_sale ?? this.sale.total ?? 0),
      net_amount: Number(this.sale.total_sale ?? this.sale.total ?? 0),
      status: this.sale.status,
      payment_status: this.sale.payment_status,
      notes: this.sale.comments || null,
      commercial: this.sale.commercial?.name || null,
      carrier: this.sale.carrier?.name || null,
      tracking_number: this.sale.tracking_number || null,
      partner: this.sale.partner?.name || null,
      service: this.sale.service || null,
      delivery_date: this.sale.delivery_date || null,
      payment_method: this.sale.payment_method || null,
    });
  }

  get clientName(): string {
    return this.sale?.linked_client?.name?.trim() || this.sale?.client?.trim() || '-';
  }

  get clientPhone(): string {
    return this.sale?.linked_client?.phone?.trim() || this.sale?.client_phone?.trim() || '-';
  }

  get clientCity(): string {
    return this.sale?.linked_client?.city?.trim() || this.sale?.city?.trim() || '-';
  }

  get outstandingBalance(): number {
    return Number(this.sale?.client_summary?.outstanding_balance ?? 0);
  }

  get creditLimit(): number {
    return Number(this.sale?.client_summary?.credit_limit ?? this.sale?.linked_client?.credit_limit ?? 0);
  }

  get showAccountWarning(): boolean {
    return !!this.sale?.client_id && !!this.sale?.client_summary;
  }

  get overCreditLimit(): boolean {
    return this.creditLimit > 0 && this.outstandingBalance > this.creditLimit;
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product || item.product;
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

  lineTotal(item: any): number {
    if (item.total != null) {
      return Number(item.total);
    }

    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const unitPrice = Number(item.selling_price ?? item.unit_price ?? 0);
    return unitPrice * Number(item.quantity || 0) * (1 - discount / 100);
  }
}
