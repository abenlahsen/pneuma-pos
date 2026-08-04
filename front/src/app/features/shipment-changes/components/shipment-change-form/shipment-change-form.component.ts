import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sale } from '../../../../core/models/sale.model';
import { Carrier } from '../../../carriers/models/carrier.model';
import { CarrierService } from '../../../carriers/data-access/carrier.service';
import {
  ShipmentChangeField,
  ShipmentChangeItem,
  ShipmentChangeRequest,
  ShipmentChangeRequestPayload,
  SHIPMENT_CHANGE_FIELD_LABELS,
} from '../../models/shipment-change.model';

@Component({
  selector: 'app-shipment-change-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipment-change-form.component.html',
  styleUrl: './shipment-change-form.component.scss',
})
export class ShipmentChangeFormComponent implements OnInit {
  @Input({ required: true }) sale!: Sale;
  @Input() request: ShipmentChangeRequest | null = null;
  @Output() save = new EventEmitter<ShipmentChangeRequestPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly fieldOptions: { value: ShipmentChangeField; label: string }[] = (
    Object.keys(SHIPMENT_CHANGE_FIELD_LABELS) as ShipmentChangeField[]
  ).map((value) => ({ value, label: SHIPMENT_CHANGE_FIELD_LABELS[value] }));

  carriers = signal<Carrier[]>([]);
  carrierId = signal<number | null>(null);
  shipmentNumber = signal('');
  date = signal(new Date().toISOString().slice(0, 10));
  reason = signal('');
  items = signal<ShipmentChangeItem[]>([]);

  constructor(private carrierService: CarrierService) {}

  ngOnInit(): void {
    this.carrierService.getCarriers({ all: true }).subscribe({
      next: (res: any) => this.carriers.set(Array.isArray(res) ? res : res.data),
    });

    if (this.request) {
      this.carrierId.set(this.request.carrier_id);
      this.shipmentNumber.set(this.request.shipment_number || '');
      this.date.set(this.request.date);
      this.reason.set(this.request.reason || '');
      this.items.set((this.request.items || []).map(i => ({ ...i })));
    } else {
      this.carrierId.set(this.sale.carrier_id ?? this.sale.carrier?.id ?? null);
      this.shipmentNumber.set(this.sale.tracking_number || '');
      this.addItem();
    }
  }

  addItem(): void {
    const field: ShipmentChangeField = 'payment_method';
    this.items.update(list => [...list, {
      field,
      custom_label: null,
      old_value: this.prefillOldValue(field),
      new_value: '',
    }]);
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  onFieldChange(index: number, field: ShipmentChangeField): void {
    this.items.update(list => list.map((item, i) => i === index
      ? { ...item, field, custom_label: field === 'other' ? item.custom_label : null, old_value: this.prefillOldValue(field) }
      : item));
  }

  private prefillOldValue(field: ShipmentChangeField): string {
    switch (field) {
      case 'recipient_name':
        return this.sale?.linked_client?.name?.trim() || this.sale?.client?.trim() || '';
      case 'recipient_phone':
        return this.sale?.linked_client?.phone?.trim() || this.sale?.client_phone?.trim() || '';
      case 'city':
        return this.sale?.linked_client?.city?.trim() || this.sale?.city?.trim() || '';
      case 'amount':
        return String(this.sale?.total_sale ?? this.sale?.total ?? '');
      case 'payment_method':
        return this.sale?.payment_methods?.length ? this.sale.payment_methods.join(', ') : '';
      default:
        return '';
    }
  }

  get canSubmit(): boolean {
    return !!this.date() && this.items().length > 0 && this.items().every(i => !!i.new_value?.trim());
  }

  onSubmit(): void {
    if (!this.canSubmit) return;

    this.save.emit({
      carrier_id: this.carrierId(),
      shipment_number: this.shipmentNumber() || null,
      date: this.date(),
      reason: this.reason() || null,
      items: this.items(),
    });
  }
}
