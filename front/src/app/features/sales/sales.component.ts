import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { PaymentPanelComponent } from './payment-panel/payment-panel.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SaleFormComponent, PaymentPanelComponent],
  templateUrl: './sales.component.html',
  styleUrl: './sales.component.scss',
})
export class SalesComponent implements OnInit {
  // Data
  sales = signal<Sale[]>([]);
  summary = signal<SaleSummary>({ total_purchase: 0, total_sale: 0, margin: 0 });
  filterOptions = signal<SaleFilters>({ brands: [], clients: [], cities: [], statuses: [], partners: [], payment_statuses: [] });

  // Pagination
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  // Filters
  filterSearch = signal('');
  filterBrand = signal('');
  filterClient = signal('');
  filterCity = signal('');
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterPartner = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  // UI state
  loading = signal(false);
  showForm = signal(false);
  editingSale = signal<Sale | null>(null);
  paymentSale = signal<Sale | null>(null);

  constructor(
    private saleService: SaleService,
    private authService: AuthService,
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
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
    };
  }

  applyFilters(): void {
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
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
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
    if (confirm(`Voulez-vous vraiment supprimer cette vente ?\nClient: ${sale.client} - Produit: ${sale.dimension} ${sale.brand}`)) {
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
