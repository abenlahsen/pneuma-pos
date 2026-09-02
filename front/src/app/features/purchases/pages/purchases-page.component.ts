import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PurchaseService } from '../data-access/purchase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Purchase, PurchaseSummary } from '../models/purchase.model';
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TRANSITIONS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, PurchaseStatus } from '../../../core/constants/status.constants';
import { PAYMENT_METHODS, paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { PurchaseFormComponent } from '../purchase-form/purchase-form.component';
import { PurchaseDetailComponent } from '../purchase-detail/purchase-detail.component';
import { PurchasePaymentsComponent } from '../purchase-payments/purchase-payments.component';
import { PurchaseReturnComponent } from '../purchase-return/purchase-return.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { DetailNavigator } from '../../../core/utils/detail-navigator';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PurchaseFormComponent, PurchaseDetailComponent, PurchasePaymentsComponent, PurchaseReturnComponent, AutoRefreshControlComponent],
  templateUrl: './purchases-page.component.html',
  styleUrls: ['./purchases-page.component.scss']
})
export class PurchasesPageComponent implements OnInit {
  readonly PURCHASE_STATUSES = PURCHASE_STATUSES;
  readonly PURCHASE_STATUS_LABELS = PURCHASE_STATUS_LABELS;
  readonly PAYMENT_STATUSES = PAYMENT_STATUSES;
  readonly PAYMENT_STATUS_LABELS = PAYMENT_STATUS_LABELS;
  readonly PAYMENT_METHODS = PAYMENT_METHODS;
  readonly paymentMethodClass = paymentMethodClass;

  private purchaseService = inject(PurchaseService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
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
  filterPaymentMethod = signal('');
  filterSupplier = signal('');
  filterCommercial = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterWithInvoice = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  isExporting = signal(false);
  exportError = signal('');

  isFormOpen = signal<boolean>(false);
  selectedPurchase = signal<Purchase | null>(null);
  detailPurchase = signal<Purchase | null>(null);
  paymentPurchase = signal<Purchase | null>(null);
  returnPurchase = signal<Purchase | null>(null);

  /** Précédent / Suivant inside the detail modal — follows the table order across pages. */
  readonly detailNav = new DetailNavigator<Purchase>({
    items: this.purchases,
    current: this.detailPurchase,
    page: this.currentPage,
    lastPage: this.lastPage,
    perPage: this.perPage,
    total: this.total,
    loading: this.loading,
    goToPage: (page) => this.goToPage(page),
  });

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

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        if (!Number.isFinite(id) || id <= 0) return;

        this.purchaseService.getPurchase(id).subscribe({
          next: purchase => this.openDetail(purchase),
        });
      });
  }

  private buildFilters(): Record<string, string> {
    return {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
      status: this.filterStatus(),
      payment_status: this.filterPaymentStatus(),
      payment_method: this.filterPaymentMethod(),
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
        this.detailNav.onListLoaded();
      },
      error: (err) => {
        console.error('Error loading purchases', err);
        this.loading.set(false);
        this.detailNav.reset();
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
    this.filterPaymentMethod.set('');
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
    this.detailNav.reset();
  }

  editFromDetail(): void {
    const purchase = this.detailPurchase();
    if (!purchase) return;
    this.closeDetail();
    this.openForm(purchase);
  }

  returnFromDetail(): void {
    const purchase = this.detailPurchase();
    if (!purchase) return;
    this.closeDetail();
    this.openReturn(purchase);
  }

  openReturn(purchase: Purchase): void {
    this.returnPurchase.set(purchase);
  }

  closeReturn(): void {
    this.returnPurchase.set(null);
  }

  onReturnSaved(): void {
    this.closeReturn();
    this.loadData();
  }

  /** A return was deleted from inside the detail modal — refresh both the list and the still-open modal's now-stale purchase. */
  onDetailReturnsChanged(): void {
    this.loadData();
    const current = this.detailPurchase();
    if (!current) return;
    this.purchaseService.getPurchase(current.id).subscribe({
      next: (purchase) => this.detailPurchase.set(purchase),
    });
  }

  canReturnPurchase(purchase: Purchase): boolean {
    return this.authService.hasPermission('cancel purchases') && purchase.status !== 'ANNULE';
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

    this.purchaseService.patchStatus(purchase.id, newStatus as PurchaseStatus).subscribe({
      next: () => {
      },
      error: (err) => {
        purchase.status = oldStatus;
        const msg = err?.error?.errors?.status?.[0] || err?.error?.message || 'Erreur lors de la mise à jour du statut.';
        alert(msg);
      }
    });
  }

  isPurchaseLocked(purchase: Purchase): boolean {
    return purchase.status === 'TERMINE' && !this.authService.hasRole('Administrator');
  }

  /** Current status kept first (so it stays selected) followed by the statuses it can legally move to. */
  statusOptionsFor(purchase: Purchase): PurchaseStatus[] {
    const current = purchase.status as PurchaseStatus;
    return [current, ...(PURCHASE_STATUS_TRANSITIONS[current] || [])];
  }

  exportPurchases(): void {
    this.isExporting.set(true);
    this.exportError.set('');
    const filters = { ...this.buildFilters() };
    delete filters['page'];
    delete filters['per_page'];

    this.purchaseService.exportPurchases(filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `achats_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => {
        this.exportError.set("Erreur lors de l'export.");
        this.isExporting.set(false);
      },
    });
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