import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceOrder, ServiceOrderFilters, ServiceOrderPayload, ServiceOrderSummary } from '../../../core/models/service-order.model';
import { ServiceOrderService } from '../data-access/service-order.service';
import { ServiceOrderFormComponent } from '../service-order-form/service-order-form.component';
import { ServicePaymentPanelComponent } from '../service-payment-panel/service-payment-panel.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-service-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ServiceOrderFormComponent,
    ServicePaymentPanelComponent,
  ],
  templateUrl: './service-orders.component.html',
  styleUrls: ['./service-orders.component.scss'],
})
export class ServiceOrdersComponent implements OnInit {
  serviceOrders = signal<ServiceOrder[]>([]);
  summary = signal<ServiceOrderSummary>({ total_revenue: 0, total_paid: 0, remaining: 0 });
  filterOptions = signal<ServiceOrderFilters>({ service_types: [], commercials: [] });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  filterClient = signal('');
  filterServiceType = signal('');
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterCommercial = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  loading = signal(false);
  showForm = signal(false);
  editingOrder = signal<ServiceOrder | null>(null);
  paymentOrder = signal<ServiceOrder | null>(null);
  deletingId = signal<number | null>(null);

  constructor(
    private serviceOrderService: ServiceOrderService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
    this.loadSummary();
  }

  loadData(): void {
    this.loading.set(true);
    this.serviceOrderService.getServiceOrders(this.buildFilters()).subscribe({
      next: (res) => {
        this.serviceOrders.set(res.data);
        this.total.set(res.total);
        this.currentPage.set(res.current_page);
        this.lastPage.set(res.last_page);
        this.perPage.set(res.per_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSummary(): void {
    this.serviceOrderService.getSummary(this.buildFilters()).subscribe({
      next: (s) => this.summary.set(s),
    });
  }

  loadFilters(): void {
    this.serviceOrderService.getFilters().subscribe({
      next: (f) => this.filterOptions.set(f),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
    this.loadSummary();
  }

  resetFilters(): void {
    this.filterClient.set('');
    this.filterServiceType.set('');
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterCommercial.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.currentPage.set(page);
    this.loadData();
  }

  openAddForm(): void {
    this.editingOrder.set(null);
    this.showForm.set(true);
  }

  openEditForm(order: ServiceOrder): void {
    this.serviceOrderService.getServiceOrder(order.id).subscribe({
      next: (full) => {
        this.editingOrder.set(full);
        this.showForm.set(true);
      },
    });
  }

  orderServiceTypes(order: ServiceOrder): string[] {
    return (order.items ?? []).map(it => it.service_type).filter(Boolean);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingOrder.set(null);
  }

  onFormSubmit(payload: ServiceOrderPayload): void {
    const editing = this.editingOrder();
    if (editing) {
      this.serviceOrderService.updateServiceOrder(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadSummary();
        },
      });
    } else {
      this.serviceOrderService.createServiceOrder(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadSummary();
        },
      });
    }
  }

  deleteOrder(order: ServiceOrder): void {
    if (!confirm(`Supprimer l'intervention de ${order.client} ?`)) return;
    this.deletingId.set(order.id);
    this.serviceOrderService.deleteServiceOrder(order.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadData();
        this.loadSummary();
      },
      error: () => this.deletingId.set(null),
    });
  }

  openPayments(order: ServiceOrder): void {
    this.paymentOrder.set(order);
  }

  closePayments(): void {
    this.paymentOrder.set(null);
    this.loadData();
    this.loadSummary();
  }

  buildFilters(): Record<string, string> {
    const f: Record<string, string> = {
      page: String(this.currentPage()),
      per_page: String(this.perPage()),
    };
    if (this.filterClient()) f['client'] = this.filterClient();
    if (this.filterServiceType()) f['service_type'] = this.filterServiceType();
    if (this.filterStatus()) f['status'] = this.filterStatus();
    if (this.filterPaymentStatus()) f['payment_status'] = this.filterPaymentStatus();
    if (this.filterCommercial()) f['commercial_id'] = this.filterCommercial();
    if (this.filterDateFrom()) f['date_from'] = this.filterDateFrom();
    if (this.filterDateTo()) f['date_to'] = this.filterDateTo();
    return f;
  }

  get pages(): number[] {
    const current = this.currentPage();
    const last = this.lastPage();
    const range: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(last, current + 2); i++) {
      range.push(i);
    }
    return range;
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
