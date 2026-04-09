import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Purchase } from '../../../core/models/purchase.model';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['../../sales/sale-detail/sale-detail.component.scss', './purchase-detail.component.scss']
})
export class PurchaseDetailComponent {
  @Input({ required: true }) purchase!: Purchase;
  @Output() close = new EventEmitter<void>();

  printDocument(): void {
    window.print();
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }
}
