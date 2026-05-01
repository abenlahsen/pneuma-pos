import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ServiceItem,
  ServiceOrder,
  ServiceOrderPayload,
} from '../../../core/models/service-order.model';

const SERVICE_TYPES = [
  'Vidange',
  'Freinage',
  'Batterie',
  'Filtres',
  'Amortisseurs',
  'Climatisation',
  'Distribution',
  'Géométrie',
  'Autre',
];

interface ItemForm {
  service_type: string;
  description: string;
  parts_cost: number;
  labor_cost: number;
}

@Component({
  selector: 'app-service-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-order-form.component.html',
  styleUrls: ['./service-order-form.component.scss'],
})
export class ServiceOrderFormComponent implements OnInit {
  @Input() serviceOrder: ServiceOrder | null = null;
  @Input() initialCommercials: { id: number; name: string }[] = [];

  @Output() save = new EventEmitter<ServiceOrderPayload>();
  @Output() cancel = new EventEmitter<void>();

  readonly serviceTypes = SERVICE_TYPES;

  date = signal(new Date().toISOString().split('T')[0]);
  client = signal('');
  phone = signal('');
  vehicle = signal('');
  mileage = signal<number | null>(null);
  discount = signal(0);
  status = signal<string>('EN COURS');
  notes = signal('');
  commercial_id = signal<number | null>(null);

  items = signal<ItemForm[]>([
    { service_type: '', description: '', parts_cost: 0, labor_cost: 0 },
  ]);

  totalAmount = computed(() =>
    this.items().reduce((sum, it) => sum + (Number(it.parts_cost) || 0) + (Number(it.labor_cost) || 0), 0)
  );

  netAmount = computed(() => Math.max(0, this.totalAmount() - (Number(this.discount()) || 0)));

  trackByIndex = (index: number) => index;

  ngOnInit(): void {
    if (this.serviceOrder) {
      this.date.set(this.serviceOrder.date);
      this.client.set(this.serviceOrder.client);
      this.phone.set(this.serviceOrder.phone ?? '');
      this.vehicle.set(this.serviceOrder.vehicle);
      this.mileage.set(this.serviceOrder.mileage ?? null);
      this.discount.set(Number(this.serviceOrder.discount) || 0);
      this.status.set(this.serviceOrder.status);
      this.notes.set(this.serviceOrder.notes ?? '');
      this.commercial_id.set(this.serviceOrder.commercial_id ?? null);

      if (this.serviceOrder.items && this.serviceOrder.items.length > 0) {
        this.items.set(
          this.serviceOrder.items.map((it: ServiceItem) => ({
            service_type: it.service_type,
            description: it.description ?? '',
            parts_cost: Number(it.parts_cost) || 0,
            labor_cost: Number(it.labor_cost) || 0,
          }))
        );
      }
    }
  }

  addItem(): void {
    this.items.update(list => [
      ...list,
      { service_type: '', description: '', parts_cost: 0, labor_cost: 0 },
    ]);
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  updateItem(index: number, field: keyof ItemForm, value: string | number): void {
    this.items.update(list => {
      const copy = [...list];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  itemLineTotal(item: ItemForm): number {
    return (Number(item.parts_cost) || 0) + (Number(item.labor_cost) || 0);
  }

  onSubmit(): void {
    const payload: ServiceOrderPayload = {
      date: this.date(),
      client: this.client(),
      phone: this.phone() || null,
      vehicle: this.vehicle(),
      mileage: this.mileage(),
      items: this.items().map((it, i) => ({
        service_type: it.service_type,
        description: it.description || null,
        parts_cost: Number(it.parts_cost) || 0,
        labor_cost: Number(it.labor_cost) || 0,
        sort_order: i,
      })),
      discount: Number(this.discount()) || 0,
      status: this.status(),
      notes: this.notes() || null,
      commercial_id: this.commercial_id(),
    };
    this.save.emit(payload);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  get isEditing(): boolean {
    return this.serviceOrder !== null;
  }
}
