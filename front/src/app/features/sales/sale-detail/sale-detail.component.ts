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

  get productLabel(): string {
    const p = this.sale.linked_product;
    if (!p) return this.sale.brand ? `${this.sale.brand} ${this.sale.dimension || ''}` : '-';
    const brand = p.brand?.name || '';
    const dim = p.tire_width ? `${p.tire_width}/${p.tire_height}R${p.tire_diameter}` : '';
    const profile = p.profile || '';
    const ref = p.reference || '';
    return [ref, brand, dim, profile].filter(Boolean).join(' — ');
  }
}
