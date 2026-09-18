import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PurchaseService } from '../data-access/purchase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Purchase, PurchaseGroupRow, PurchaseSummary, PurchaseSupplierGroup } from '../models/purchase.model';
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_TRANSITIONS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, PurchaseStatus } from '../../../core/constants/status.constants';
import { PAYMENT_METHODS, paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { PurchaseFormComponent } from '../purchase-form/purchase-form.component';
import { PurchaseDetailComponent } from '../purchase-detail/purchase-detail.component';
import { PurchasePaymentsComponent } from '../purchase-payments/purchase-payments.component';
import { PurchaseReturnComponent } from '../purchase-return/purchase-return.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { SortIconComponent } from '../../../shared/icon/sort-icon.component';
import { DetailNavigator } from '../../../core/utils/detail-navigator';
import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  RowLockComponent,
  SkeletonRowComponent,
  describeLoadError,
  frenchDate,
} from '../../../shared/list-state';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PurchaseFormComponent, PurchaseDetailComponent, PurchasePaymentsComponent, PurchaseReturnComponent, AutoRefreshControlComponent, SortIconComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, RowLockComponent],
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

  // ── Refonte 2b : groupés par fournisseur, deux jeux de filtres ─────────────
  readonly groups = signal<PurchaseSupplierGroup[]>([]);
  readonly settlementTab = signal<'' | 'due' | 'legal_risk' | 'paid'>('due');
  readonly receptionTab = signal<'' | 'expected' | 'received'>('');
  readonly showFilters = signal(false);
  readonly expandedPurchases = signal<Set<number>>(new Set());

  /** Seuil d'ancienneté affiché ligne par ligne. Voir PurchaseService::OLD_DEBT_DAYS. */
  readonly oldDebtDays = 90;

  readonly groupsDueTotal = computed(() =>
    this.groups().reduce((sum, group) => sum + group.due_total, 0)
  );

  readonly groupsPurchaseCount = computed(() =>
    this.groups().reduce((sum, group) => sum + group.purchases.length, 0)
  );

  setSettlementTab(tab: '' | 'due' | 'legal_risk' | 'paid'): void {
    this.settlementTab.set(tab);
    this.currentPage.set(1);
    this.loadData();
  }

  setReceptionTab(tab: '' | 'expected' | 'received'): void {
    this.receptionTab.set(tab);
    this.currentPage.set(1);
    this.loadData();
  }

  toggleReturns(purchaseId: number): void {
    this.expandedPurchases.update((set) => {
      const next = new Set(set);
      next.has(purchaseId) ? next.delete(purchaseId) : next.add(purchaseId);
      return next;
    });
  }

  returnsVisible(purchaseId: number): boolean {
    return this.expandedPurchases().has(purchaseId);
  }

  isOldDebt(row: PurchaseGroupRow): boolean {
    return row.remaining > 0.004 && row.days > this.oldDebtDays;
  }

  /** Une ligne de groupe suffit pour ouvrir la fiche ou le règlement existants. */
  openRowDetail(row: PurchaseGroupRow): void {
    this.purchaseService.getPurchase(row.id).subscribe({
      next: (purchase) => this.openDetail(purchase),
    });
  }

  openRowPayments(row: PurchaseGroupRow): void {
    this.purchaseService.getPurchase(row.id).subscribe({
      next: (purchase) => this.openPayments(purchase),
    });
  }
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

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Les deux onglets comptent parmi les filtres : « Reste à payer » est actif
   * par défaut et écarte les achats réglés. Sans le nommer ici, une liste vide
   * laisserait chercher longtemps.
   */
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const applied: ActiveFilter[] = [];
    const drop = (label: string, apply: () => void) => {
      applied.push({
        label,
        clear: () => {
          apply();
          this.currentPage.set(1);
          this.loadData();
        },
      });
    };

    const settlementLabels: Record<string, string> = {
      due: 'reste à payer',
      legal_risk: `plus de ${this.oldDebtDays} jours`,
      paid: 'réglés',
    };
    const settlement = this.settlementTab();
    if (settlement) drop(settlementLabels[settlement], () => this.settlementTab.set(''));

    const reception = this.receptionTab();
    if (reception) drop(reception === 'expected' ? 'attendues' : 'reçues', () => this.receptionTab.set(''));

    if (this.filterSearch()) drop(`recherche « ${this.filterSearch()} »`, () => this.filterSearch.set(''));
    if (this.filterStatus()) {
      const label = PURCHASE_STATUS_LABELS[this.filterStatus() as PurchaseStatus] ?? this.filterStatus();
      drop(`statut ${label.toLowerCase()}`, () => this.filterStatus.set(''));
    }
    if (this.filterPaymentStatus()) drop(this.filterPaymentStatus().toLowerCase(), () => this.filterPaymentStatus.set(''));
    if (this.filterPaymentMethod()) drop(`règlement ${this.filterPaymentMethod().toLowerCase()}`, () => this.filterPaymentMethod.set(''));
    if (this.filterSupplier()) {
      const supplier = this.filterOptions().suppliers.find((s) => String(s.id) === this.filterSupplier());
      drop(`fournisseur ${supplier?.name ?? this.filterSupplier()}`, () => this.filterSupplier.set(''));
    }
    if (this.filterCommercial()) {
      const commercial = this.filterOptions().commercials.find((c) => String(c.id) === this.filterCommercial());
      drop(`commercial ${commercial?.name ?? this.filterCommercial()}`, () => this.filterCommercial.set(''));
    }
    if (this.filterDateFrom()) drop(`à partir du ${frenchDate(this.filterDateFrom())}`, () => this.filterDateFrom.set(''));
    if (this.filterDateTo()) drop(`jusqu'au ${frenchDate(this.filterDateTo())}`, () => this.filterDateTo.set(''));
    if (this.filterWithInvoice()) {
      drop(this.filterWithInvoice() === 'true' ? 'avec facture' : 'sans facture', () => this.filterWithInvoice.set(''));
    }
    if (this.filterAmountMin()) drop(`montant ≥ ${this.filterAmountMin()}`, () => this.filterAmountMin.set(''));
    if (this.filterAmountMax()) drop(`montant ≤ ${this.filterAmountMax()}`, () => this.filterAmountMax.set(''));

    return applied;
  });

  /** « Tout effacer » depuis la liste vide : remet aussi les deux onglets à zéro. */
  clearAllFilters(): void {
    this.settlementTab.set('');
    this.receptionTab.set('');
    this.resetFilters();
  }
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

    this.purchaseService.getGrouped({
      ...filters,
      settlement: this.settlementTab(),
      reception: this.receptionTab(),
      per_page: '15',
    }).subscribe({
      next: (response) => {
        this.groups.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        // Les groupes déjà affichés restent : l'écran d'erreur dit de quand
        // ils datent plutôt que de vider la page.
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });

    this.purchaseService.getPurchases(filters).subscribe({
      next: (response) => {
        // La liste plate reste chargée pour la navigation Précédent / Suivant
        // dans la fiche ; c'est la vue groupée qui pilote la pagination.
        this.purchases.set(response.data);
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