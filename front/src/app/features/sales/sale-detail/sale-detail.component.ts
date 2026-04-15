import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../../core/models/sale.model';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.scss'
})
export class SaleDetailComponent {
  @Input({ required: true }) sale!: Sale;
  @Output() close = new EventEmitter<void>();

  printDocument(): void {
    window.print();
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  lineTotal(item: any): number {
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    return (item.selling_price || 0) * (item.quantity || 0) * (1 - discount / 100);
  }
}
