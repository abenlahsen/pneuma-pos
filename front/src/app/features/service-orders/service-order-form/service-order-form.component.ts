import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  PartSearchResult,
  ServiceOrder,
  ServiceOrderPayload,
} from '../../../core/models/service-order.model';
import { ServiceOrderService } from '../data-access/service-order.service';
import { ClientService } from '../../clients/data-access/client.service';
import { Client } from '../../clients/models/client.model';
import { ProductService } from '../../products/data-access/product.service';
import { Vehicle } from '../../../features/vehicles/models/vehicle.model';
import { VehicleSelectorComponent } from '../../../shared/vehicle-selector/vehicle-selector.component';

interface ServiceProductOption {
  id: number;
  profile: string | null;
  reference: string | null;
  selling_price: number | null;
}

interface ServiceLineForm {
  item_type: 'service';
  service_type: string;
  description: string;
  quantity: number;
  parts_cost: number;
  labor_cost: number;
}

interface PartLineForm {
  item_type: 'part';
  product_id: number | null;
  product_name: string;
  product_reference: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_quantity: number;
  searchQuery: string;
  searchResults: PartSearchResult[];
  searching: boolean;
}

type AnyLineForm = ServiceLineForm | PartLineForm;

@Component({
  selector: 'app-service-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleSelectorComponent],
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
  private serviceOrderService = inject(ServiceOrderService);

  serviceProducts = signal<ServiceProductOption[]>([]);

  // Form header fields
  date = signal(new Date().toISOString().split('T')[0]);
  vehicle = signal('');
  vehicle_id = signal<number | null>(null);
  selectedVehicleObj = signal<Vehicle | null>(null);
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

  // Lines
  lines = signal<AnyLineForm[]>([
    { item_type: 'service', service_type: '', description: '', quantity: 1, parts_cost: 0, labor_cost: 0 },
  ]);

  totalAmount = computed(() =>
    this.lines().reduce((sum, line) => {
      if (line.item_type === 'part') {
        return sum + (Number(line.quantity) || 1) * (Number(line.unit_price) || 0);
      }
      return sum + (Number(line.quantity) || 1) * (Number(line.labor_cost) || 0);
    }, 0)
  );

  netAmount = computed(() =>
    Math.max(0, this.totalAmount() * (1 - (Number(this.discount()) || 0) / 100))
  );

  readonly vehicleValid = computed(() => {
    if (this.client_id()) {
      return this.vehicle_id() !== null;
    }
    return this.vehicle().trim().length > 0;
  });

  hasValidLines = computed(() =>
    this.lines().some(line => {
      if (line.item_type === 'service') return line.service_type.trim().length > 0;
      return line.product_id !== null;
    })
  );

  hasStockError = computed(() =>
    this.lines().some(line => {
      if (line.item_type !== 'part') return false;
      if (!line.product_id) return false;
      return line.total_quantity < (Number(line.quantity) || 1);
    })
  );

  stockErrorMessage = computed(() => {
    const bad = this.lines().filter(line =>
      line.item_type === 'part' && line.product_id && line.total_quantity < (Number(line.quantity) || 1)
    ) as PartLineForm[];
    if (!bad.length) return '';
    return bad.map(l =>
      l.total_quantity === 0
        ? `${l.product_name || 'Pièce'} : rupture de stock`
        : `${l.product_name || 'Pièce'} : stock insuffisant (dispo ${l.total_quantity}, demandé ${l.quantity})`
    ).join(' • ');
  });

  ngOnInit(): void {
    this.loadServiceProducts();

    if (this.serviceOrder) {
      this.date.set(this.serviceOrder.date);
      this.vehicle.set(this.serviceOrder.vehicle);
      this.vehicle_id.set(this.serviceOrder.vehicle_id ?? null);
      this.mileage.set(this.serviceOrder.mileage ?? null);
      this.discount.set(Number(this.serviceOrder.discount) || 0);
      this.status.set(this.serviceOrder.status);
      this.notes.set(this.serviceOrder.notes ?? '');
      this.commercial_id.set(this.serviceOrder.commercial_id ?? null);
      this.client_id.set(this.serviceOrder.client_id ?? null);
      this.clientSearch.set(this.serviceOrder.client_record?.name ?? '');

      if (this.serviceOrder.items?.length) {
        const mapped: AnyLineForm[] = this.serviceOrder.items.map(it => {
          if (it.item_type === 'part') {
            return {
              item_type: 'part',
              product_id: it.product_id ?? null,
              product_name: it.product_name ?? '',
              product_reference: it.product_reference ?? '',
              unit: 'pièce',
              quantity: it.quantity ?? 1,
              unit_price: Number(it.unit_price) || 0,
              total_quantity: it.total_quantity ?? 0,
              searchQuery: it.product_name ?? '',
              searchResults: [],
              searching: false,
            } as PartLineForm;
          }
          return {
            item_type: 'service',
            service_type: it.service_type ?? '',
            description: it.description ?? '',
            quantity: Number(it.quantity) || 1,
            parts_cost: Number(it.parts_cost) || 0,
            labor_cost: Number(it.labor_cost) || 0,
          } as ServiceLineForm;
        });
        this.lines.set(mapped);
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

  // --- Lines management ---

  addServiceLine(): void {
    this.lines.update(l => [...l, {
      item_type: 'service', service_type: '', description: '', quantity: 1, parts_cost: 0, labor_cost: 0,
    }]);
  }

  addPartLine(): void {
    this.lines.update(l => [...l, {
      item_type: 'part',
      product_id: null, product_name: '', product_reference: '',
      unit: 'pièce', quantity: 1, unit_price: 0, total_quantity: 0,
      searchQuery: '', searchResults: [], searching: false,
    }]);
  }

  removeLine(index: number): void {
    if (this.lines().length === 1) return;
    this.lines.update(l => l.filter((_, i) => i !== index));
  }

  updateLine(index: number, patch: Partial<AnyLineForm>): void {
    this.lines.update(list => {
      const copy = [...list];
      copy[index] = { ...copy[index], ...patch } as AnyLineForm;
      return copy;
    });
  }

  asService(line: AnyLineForm): ServiceLineForm {
    return line as ServiceLineForm;
  }

  asPart(line: AnyLineForm): PartLineForm {
    return line as PartLineForm;
  }

  // --- Part search ---

  searchPartsFor(index: number, query: string): void {
    this.updateLine(index, { searchQuery: query } as Partial<PartLineForm>);
    if (query.length < 2) {
      this.updateLine(index, { searchResults: [] } as Partial<PartLineForm>);
      return;
    }
    this.updateLine(index, { searching: true } as Partial<PartLineForm>);
    this.serviceOrderService.searchParts(query).subscribe({
      next: (results) => this.updateLine(index, { searchResults: results, searching: false } as Partial<PartLineForm>),
      error: () => this.updateLine(index, { searching: false } as Partial<PartLineForm>),
    });
  }

  selectPart(index: number, part: PartSearchResult): void {
    this.updateLine(index, {
      product_id: part.id,
      product_name: part.name,
      product_reference: part.reference ?? '',
      unit: part.unit,
      unit_price: part.purchase_price,
      total_quantity: part.total_quantity,
      searchQuery: part.name,
      searchResults: [],
    } as Partial<PartLineForm>);
  }

  clearPartSelection(index: number): void {
    this.updateLine(index, {
      product_id: null, product_name: '', product_reference: '',
      searchQuery: '', searchResults: [],
    } as Partial<PartLineForm>);
  }

  // --- Service type selection from catalog ---

  onServiceTypeChange(index: number, productId: string): void {
    const id = Number(productId);
    const product = this.serviceProducts().find(p => p.id === id);
    if (product) {
      this.updateLine(index, {
        service_type: product.profile ?? '',
        labor_cost: Number(product.selling_price) || 0,
      } as Partial<ServiceLineForm>);
    }
  }

  // --- Client ---

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
          const haystack = [c.name, c.phone, c.city].filter(Boolean).join(' ').toLowerCase();
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
    this.vehicle_id.set(null);
    this.selectedVehicleObj.set(null);
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.client_id.set(null);
    this.clientSearch.set('');
    this.showClientSuggestions.set(false);
    this.vehicle_id.set(null);
    this.selectedVehicleObj.set(null);
  }

  onVehicleSelected(vehicle: Vehicle | null): void {
    this.selectedVehicleObj.set(vehicle);
    this.vehicle_id.set(vehicle?.id ?? null);
  }

  // --- Submit ---

  onSubmit(): void {
    const items = this.lines().map((line, i) => {
      if (line.item_type === 'part') {
        return {
          item_type: 'part' as const,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          sort_order: i,
        };
      }
      return {
        item_type: 'service' as const,
        service_type: line.service_type || null,
        description: line.description || null,
        quantity: line.quantity,
        parts_cost: 0,
        labor_cost: line.labor_cost,
        sort_order: i,
      };
    });

    const resolvedVehicle = this.selectedVehicleObj()
      ? `${this.selectedVehicleObj()!.brand} ${this.selectedVehicleObj()!.model_name}`
      : this.vehicle();

    const payload: ServiceOrderPayload = {
      client_id: this.client_id(),
      vehicle_id: this.vehicle_id(),
      date: this.date(),
      vehicle: resolvedVehicle,
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

  trackByIndex(_: number, __: unknown): number {
    return _;
  }

  serviceLineTotal(line: ServiceLineForm): number {
    return (Number(line.quantity) || 1) * (Number(line.labor_cost) || 0);
  }

  partLineTotal(line: PartLineForm): number {
    return (Number(line.quantity) || 1) * (Number(line.unit_price) || 0);
  }

  get isEditing(): boolean {
    return this.serviceOrder !== null;
  }
}
