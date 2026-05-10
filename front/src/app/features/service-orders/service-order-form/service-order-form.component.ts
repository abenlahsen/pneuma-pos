import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  ServiceItem,
  ServiceOrder,
  ServiceOrderPayload,
} from '../../../core/models/service-order.model';
import { ClientService } from '../../clients/data-access/client.service';
import { Client } from '../../clients/models/client.model';
import { ProductService } from '../../products/data-access/product.service';

interface ServiceProductOption {
  id: number;
  profile: string | null;
  reference: string | null;
  selling_price: number | null;
}

interface CheckedService {
  price: number;
  description: string;
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

  private clientService = inject(ClientService);
  private productService = inject(ProductService);

  serviceProducts = signal<ServiceProductOption[]>([]);

  // Form fields
  date = signal(new Date().toISOString().split('T')[0]);
  vehicle = signal('');
  mileage = signal<number | null>(null);
  discount = signal(0);
  status = signal<string>('EN COURS');
  notes = signal('');
  commercial_id = signal<number | null>(null);

  // Client link
  client_id = signal<number | null>(null);
  selectedClient = signal<Client | null>(null);
  clients = signal<Client[]>([]);
  filteredClients = signal<Client[]>([]);
  clientSearch = signal('');
  showClientSuggestions = signal(false);
  loadingClients = signal(false);

  // Checked services: productId → { price, description }
  checkedServices = signal<Record<number, CheckedService>>({});

  checkedCount = computed(() => Object.keys(this.checkedServices()).length);

  totalAmount = computed(() =>
    Object.values(this.checkedServices()).reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  );

  netAmount = computed(() =>
    Math.max(0, this.totalAmount() * (1 - (Number(this.discount()) || 0) / 100))
  );

  ngOnInit(): void {
    this.loadServiceProducts();

    if (this.serviceOrder) {
      this.date.set(this.serviceOrder.date);
      this.vehicle.set(this.serviceOrder.vehicle);
      this.mileage.set(this.serviceOrder.mileage ?? null);
      this.discount.set(Number(this.serviceOrder.discount) || 0);
      this.status.set(this.serviceOrder.status);
      this.notes.set(this.serviceOrder.notes ?? '');
      this.commercial_id.set(this.serviceOrder.commercial_id ?? null);
      this.client_id.set(this.serviceOrder.client_id ?? null);
      this.clientSearch.set(this.serviceOrder.client_record?.name ?? '');

      if (this.serviceOrder.items?.length) {
        const map: Record<number, CheckedService> = {};
        for (const it of this.serviceOrder.items as ServiceItem[]) {
          if (it.product_id) {
            map[it.product_id] = {
              price: (Number(it.parts_cost) || 0) + (Number(it.labor_cost) || 0),
              description: it.description ?? '',
            };
          }
        }
        this.checkedServices.set(map);
      }
    }

    this.loadClients();
  }

  private loadServiceProducts(): void {
    this.productService.getProducts({ type: 'service', is_active: '1', per_page: '500' }).subscribe({
      next: (res) => {
        this.serviceProducts.set(res.data.map(p => ({
          id: p.id,
          profile: p.profile,
          reference: p.reference,
          selling_price: p.service?.selling_price ?? null,
        })));
      },
      error: () => this.serviceProducts.set([]),
    });
  }

  private loadClients(): void {
    this.loadingClients.set(true);
    this.clientService.getClients({ per_page: 500, status: 'active' }).pipe(
      finalize(() => this.loadingClients.set(false))
    ).subscribe({
      next: (list) => {
        this.clients.set(list);
        this.syncClientSearchResults();

        if (this.client_id()) {
          const found = list.find(c => c.id === this.client_id());
          if (found) {
            this.selectedClient.set(found);
          } else if (this.serviceOrder?.client_record) {
            this.selectedClient.set({
              id: this.serviceOrder.client_id!,
              name: this.serviceOrder.client_record.name,
              phone: this.serviceOrder.client_record.phone ?? '',
            } as Client);
          }
        }
      },
      error: () => {
        this.clients.set([]);
        this.filteredClients.set([]);
      },
    });
  }

  isChecked(productId: number): boolean {
    return productId in this.checkedServices();
  }

  toggleProduct(productId: number): void {
    this.checkedServices.update(map => {
      const copy = { ...map };
      if (productId in copy) {
        delete copy[productId];
      } else {
        const product = this.serviceProducts().find(p => p.id === productId);
        copy[productId] = {
          price: product?.selling_price ?? 0,
          description: '',
        };
      }
      return copy;
    });
  }

  setPrice(productId: number, price: number): void {
    this.checkedServices.update(map => ({
      ...map,
      [productId]: { ...map[productId], price: Number(price) || 0 },
    }));
  }

  setDescription(productId: number, desc: string): void {
    this.checkedServices.update(map => ({
      ...map,
      [productId]: { ...map[productId], description: desc },
    }));
  }

  getCheckedEntry(productId: number): CheckedService {
    return this.checkedServices()[productId] ?? { price: 0, description: '' };
  }

  onClientSearchInput(value: string): void {
    this.clientSearch.set(value);
    this.showClientSuggestions.set(true);
    this.syncClientSearchResults();
  }

  private syncClientSearchResults(): void {
    const search = this.clientSearch().trim().toLowerCase();

    if (!search) {
      this.filteredClients.set(this.clients().slice(0, 8));
      return;
    }

    this.filteredClients.set(
      this.clients()
        .filter(c => {
          const haystack = [c.name, c.phone, c.city]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        })
        .slice(0, 8)
    );
  }

  selectClient(c: Client): void {
    this.selectedClient.set(c);
    this.client_id.set(c.id);
    this.clientSearch.set(c.name);
    this.showClientSuggestions.set(false);
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.client_id.set(null);
    this.clientSearch.set('');
    this.showClientSuggestions.set(false);
  }

  onSubmit(): void {
    const items = Object.entries(this.checkedServices()).map(([productIdStr, entry], i) => ({
      product_id: Number(productIdStr),
      description: entry.description || null,
      parts_cost: 0,
      labor_cost: Number(entry.price) || 0,
      sort_order: i,
    }));

    const payload: ServiceOrderPayload = {
      client_id: this.client_id(),
      date: this.date(),
      vehicle: this.vehicle(),
      mileage: this.mileage(),
      items,
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
