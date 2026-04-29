import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Purchase } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, ProductDetailComponent],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['../../sales/sale-detail/sale-detail.component.scss', './purchase-detail.component.scss']
})
export class PurchaseDetailComponent {
  @Input({ required: true }) purchase!: Purchase;
  @Output() close = new EventEmitter<void>();

  viewingProduct = signal<Product | null>(null);

  printDocument(): void {
    window.print();
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
