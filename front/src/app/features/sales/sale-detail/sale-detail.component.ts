import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule, ProductDetailComponent],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.scss'
})
export class SaleDetailComponent {
  @Input({ required: true }) sale!: Sale;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  viewingProduct = signal<Product | null>(null);

  printDocument(): void {
    window.print();
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
