import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceOrder } from '../../../core/models/service-order.model';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';

@Component({
  selector: 'app-service-order-detail',
  standalone: true,
  imports: [CommonModule, DocumentPrintComponent],
  templateUrl: './service-order-detail.component.html',
  styleUrl: './service-order-detail.component.scss',
})
export class ServiceOrderDetailComponent {
  @Input({ required: true }) serviceOrder!: ServiceOrder;
  @Input() canEdit = false;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  printDoc = signal<PrintDocument | null>(null);

  openPrint(): void {
    const lines: PrintLine[] = (this.serviceOrder.items || []).map(item => {
      if (item.item_type === 'part') {
        return {
          label: item.product_name || `Pièce #${item.product_id}`,
          reference: item.product_reference || undefined,
          qty: item.quantity ?? 1,
          unit: 'pièce',
          unit_price: Number(item.unit_price ?? 0),
          total: Number(item.line_total ?? 0),
        };
      }
      return {
        label: item.service_type || 'Prestation',
        qty: item.quantity ?? 1,
        unit_price: Number(item.labor_cost ?? 0),
        total: Number(item.line_total ?? 0),
      };
    });

    const discountAmount = Number(this.serviceOrder.discount ?? 0) > 0
      ? Number(this.serviceOrder.total_amount) - Number(this.serviceOrder.net_amount)
      : undefined;

    this.printDoc.set({
      type: 'service_order',
      doc_number: String(this.serviceOrder.id),
      date: this.serviceOrder.date,
      party_label: 'Client',
      party_name: this.clientName,
      party_phone: this.clientPhone,
      vehicle: this.serviceOrder.vehicle,
      mileage: this.serviceOrder.mileage,
      lines,
      total_ht: Number(this.serviceOrder.total_amount),
      discount_global: discountAmount,
      net_amount: Number(this.serviceOrder.net_amount),
      status: this.serviceOrder.status,
      payment_status: this.serviceOrder.payment_status,
      notes: this.serviceOrder.notes,
      commercial: this.serviceOrder.commercial?.name || null,
    });
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
