import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../core/services/sale.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Sale,
  SalePayload,
  SaleSummary,
  SaleFilters,
  PaginatedResponse,
} from '../../core/models/sale.model';
import { SaleFormComponent } from './sale-form/sale-form.component';
import { SaleDetailComponent } from './sale-detail/sale-detail.component';
import { PaymentPanelComponent } from './payment-panel/payment-panel.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, SaleFormComponent, SaleDetailComponent, PaymentPanelComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  // Data
  sales = signal<Sale[]>([]);
  summary = signal<SaleSummary>({ total_purchase: 0, total_sale: 0, margin: 0, tyres_this_month: 0, tyres_today: 0, tyres_en_cours: 0, sales_en_cours: 0, total_unpaid: 0 });
  filterOptions = signal<SaleFilters>({ brands: [], clients: [], cities: [], statuses: [], partners: [], payment_statuses: [], commercials: [] });

  // Pagination
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);

  // Filters
  filterSearch = signal('');
  filterBrand = signal('');
  filterClient = signal('');
  filterCity = signal('');
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterPartner = signal('');
  filterCommercial = signal<string>('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // UI state
  loading = signal(false);
  showForm = signal(false);
  editingSale = signal<Sale | null>(null);
  detailSale = signal<Sale | null>(null);
  paymentSale = signal<Sale | null>(null);

  constructor(
    private saleService: SaleService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.saleService.getSales(filters).subscribe({
      next: (response) => {
        this.sales.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.saleService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  loadFilters(): void {
    this.saleService.getFilters().subscribe({
      next: (filters) => this.filterOptions.set(filters),
    });
  }

  private buildFilters(): Record<string, string> {
    return {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
      brand: this.filterBrand(),
      client: this.filterClient(),
      city: this.filterCity(),
      status: this.filterStatus(),
      payment_status: this.filterPaymentStatus(),
      partner: this.filterPartner(),
      commercial_id: this.filterCommercial(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  toggleSort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterBrand.set('');
    this.filterClient.set('');
    this.filterCity.set('');
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterPartner.set('');
    this.filterCommercial.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openDetail(sale: Sale): void {
    this.detailSale.set(sale);
  }

  closeDetail(): void {
    this.detailSale.set(null);
  }

  openAddForm(): void {
    this.editingSale.set(null);
    this.showForm.set(true);
  }

  openEditForm(sale: Sale): void {
    this.editingSale.set(sale);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingSale.set(null);
  }

  onFormSubmit(payload: SalePayload): void {
    const editing = this.editingSale();

    if (editing) {
      this.saleService.updateSale(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    } else {
      this.saleService.createSale(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  deleteSale(sale: Sale): void {
    const productLabel = `${sale.total_quantity} article(s)`;
    if (confirm(`Voulez-vous vraiment supprimer cette vente ?\nClient: ${sale.client} - Produit: ${productLabel}`)) {
      this.saleService.deleteSale(sale.id).subscribe({
        next: () => {
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }

  openPayments(sale: Sale): void {
    this.paymentSale.set(sale);
  }

  closePayments(): void {
    this.paymentSale.set(null);
    this.loadData();
  }

  updateSaleStatus(sale: Sale, target: any): void {
    const newStatus = target.value;
    if (sale.status === newStatus) return;
    
    // Optimistic update
    const oldStatus = sale.status;
    sale.status = newStatus;
    
    this.saleService.updateSale(sale.id, { status: newStatus } as any).subscribe({
      next: () => {
        // Reload data to reflect summary changes
        this.loadData();
      },
      error: (err: any) => {
        console.error('Failed to update status', err);
        // Revert on failure
        sale.status = oldStatus;
        alert('Erreur lors de la mise à jour du statut');
      }
    });
  }

  get pages(): number[] {
    const total = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
