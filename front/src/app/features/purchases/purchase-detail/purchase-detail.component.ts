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

  get productLabel(): string {
    const p = this.purchase.linked_product;
    if (!p) return this.purchase.product || '-';
    const brand = p.brand?.name || '';
    const dim = p.tire_width ? `${p.tire_width}/${p.tire_height}R${p.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    return [ref, brand, dim, profile].filter(Boolean).join(' — ');
  }
}
