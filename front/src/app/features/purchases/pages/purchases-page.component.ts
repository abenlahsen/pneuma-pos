import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../data-access/purchase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Purchase, PurchaseSummary } from '../models/purchase.model';
import { PurchaseFormComponent } from '../purchase-form/purchase-form.component';
import { PurchaseDetailComponent } from '../purchase-detail/purchase-detail.component';
import { PurchasePaymentsComponent } from '../purchase-payments/purchase-payments.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PurchaseFormComponent, PurchaseDetailComponent, PurchasePaymentsComponent, AutoRefreshControlComponent],
  templateUrl: './purchases-page.component.html',
  styleUrls: ['./purchases-page.component.scss']
})
export class PurchasesPageComponent implements OnInit {
  private purchaseService = inject(PurchaseService);
  public authService = inject(AuthService);

  purchases = signal<Purchase[]>([]);
  summary = signal<PurchaseSummary | null>(null);
  filterOptions = signal<{ suppliers: { id: number; name: string }[]; commercials: { id: number; name: string }[] }>({ suppliers: [], commercials: [] });
  loading = signal<boolean>(false);

  currentPage = signal<number>(1);
  lastPage = signal<number>(1);
  total = signal<number>(0);
  perPage = signal<number>(100);

  filterSearch = signal('');
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterSupplier = signal('');
  filterCommercial = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterWithInvoice = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  isFormOpen = signal<boolean>(false);
  selectedPurchase = signal<Purchase | null>(null);
  detailPurchase = signal<Purchase | null>(null);
  paymentPurchase = signal<Purchase | null>(null);

  readonly pages = computed(() => {
    const pages: number[] = [];
    for (let i = 1; i <= this.lastPage(); i++) {
      pages.push(i);
    }
    return pages;
  });

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  private buildFilters(): Record<string, string> {
    return {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
      status: this.filterStatus(),
      payment_status: this.filterPaymentStatus(),
      supplier_id: this.filterSupplier(),
      commercial_id: this.filterCommercial(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      with_invoice: this.filterWithInvoice(),
      amount_min: this.filterAmountMin(),
      amount_max: this.filterAmountMax(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.purchaseService.getPurchases(filters).subscribe({
      next: (response) => {
        this.purchases.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading purchases', err);
        this.loading.set(false);
      }
    });

    this.purchaseService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  loadFilters(): void {
    this.purchaseService.getFilters().subscribe({
      next: (filters) => this.filterOptions.set(filters),
    });
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
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterSupplier.set('');
    this.filterCommercial.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterWithInvoice.set('');
    this.filterAmountMin.set('');
    this.filterAmountMax.set('');
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

  openDetail(purchase: Purchase): void {
    this.detailPurchase.set(purchase);
  }

  closeDetail(): void {
    this.detailPurchase.set(null);
  }

  editFromDetail(): void {
    const purchase = this.detailPurchase();
    if (!purchase) return;
    this.closeDetail();
    this.openForm(purchase);
  }

  openForm(purchase: Purchase | null = null): void {
    this.selectedPurchase.set(purchase);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.selectedPurchase.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.loadData();
    this.loadFilters();
  }

  openPayments(purchase: Purchase): void {
    this.paymentPurchase.set(purchase);
  }

  closePayments(): void {
    this.paymentPurchase.set(null);
    this.loadData();
  }

  updatePurchaseStatus(purchase: Purchase, target: EventTarget | null): void {
    const select = target as HTMLSelectElement | null;
    const newStatus = select?.value;
    if (!newStatus || purchase.status === newStatus) return;

    const oldStatus = purchase.status;
    purchase.status = newStatus as Purchase['status'];

    const payload = {
      date: purchase.date,
      with_invoice: purchase.with_invoice,
      supplier_id: purchase.supplier?.id || 0,
      commercial_id: purchase.commercial?.id || null,
      items: purchase.items || [],
      status: purchase.status,
      payment_status: purchase.payment_status
    };

    this.purchaseService.updatePurchase(purchase.id, payload).subscribe({
      next: () => {
      },
      error: () => {
        purchase.status = oldStatus;
      }
    });
  }

  isPurchaseLocked(purchase: Purchase): boolean {
    return purchase.status === 'TERMINE' && !this.authService.hasRole('Administrator');
  }

  deletePurchase(purchase: Purchase): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'achat (${purchase.total_quantity} articles) ?`)) {
      this.purchaseService.deletePurchase(purchase.id).subscribe({
        next: () => this.loadData(),
        error: (err) => {
          console.error('Error deleting purchase', err);
          alert('Erreur lors de la suppression.');
        }
      });
    }
  }
}