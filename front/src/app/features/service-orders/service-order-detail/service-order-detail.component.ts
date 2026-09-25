import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { ServiceOrder } from '../../../core/models/service-order.model';
import { PaymentStatus, ServiceOrderStatus } from '../../../core/constants/status.constants';

@Component({
  selector: 'app-service-order-detail',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './service-order-detail.component.html',
  styleUrl: './service-order-detail.component.scss',
})
export class ServiceOrderDetailComponent {
  @Input({ required: true }) serviceOrder!: ServiceOrder;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  constructor(private router?: Router) {}

  /**
   * Refonte 2b, étape 10 : la fiche d'intervention s'imprime sur sa propre
   * page, `/documents/service_order/:id/print`, qui relit l'intervention par
   * son `show` et la met en forme dans features/documents/print-builders.
   */
  openPrint(): void {
    if (!this.serviceOrder?.id) return;
    this.router?.navigate(['/documents', 'service_order', this.serviceOrder.id, 'print']);
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

  statusClass(status: ServiceOrderStatus): string {
    switch (status) {
      case 'TERMINE': return 'badge-success';
      case 'ANNULE': return 'badge-danger';
      default: return 'badge-warning';
    }
  }

  paymentClass(ps: PaymentStatus): string {
    switch (ps) {
      case 'PAYE': return 'badge-success';
      case 'PARTIEL': return 'badge-warning';
      default: return 'badge-danger';
    }
  }
}
