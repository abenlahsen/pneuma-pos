import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceOrder } from '../../../core/models/service-order.model';

@Component({
  selector: 'app-service-order-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-order-detail.component.html',
  styleUrl: './service-order-detail.component.scss',
})
export class ServiceOrderDetailComponent {
  @Input({ required: true }) serviceOrder!: ServiceOrder;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  printDocument(): void {
    window.print();
  }

  get clientName(): string {
    return this.serviceOrder?.client_record?.name?.trim() || '—';
  }

  get clientPhone(): string {
    return this.serviceOrder?.client_record?.phone?.trim() || '—';
  }

  itemTotal(item: any): number {
    return Number(item.line_total ?? (Number(item.parts_cost || 0) + Number(item.labor_cost || 0)));
  }

  statusClass(status: string): string {
    switch (status) {
      case 'TERMINE': return 'badge-success';
      case 'ANNULE': return 'badge-danger';
      default: return 'badge-warning';
    }
  }

  paymentClass(ps: string): string {
    switch (ps) {
      case 'PAYE': return 'badge-success';
      case 'PARTIEL': return 'badge-warning';
      default: return 'badge-danger';
    }
  }
}
