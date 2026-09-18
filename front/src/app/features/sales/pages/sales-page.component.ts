import { Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { SaleDetailComponent } from '../sale-detail/sale-detail.component';
import { PaymentPanelComponent } from '../payment-panel/payment-panel.component';
import { Sale, SaleFilters, SaleSummary } from '../models/sale.model';
import { SALE_STATUSES, SALE_STATUS_LABELS, SALE_STATUS_TRANSITIONS, SaleStatus } from '../../../core/constants/status.constants';
import { PAYMENT_METHODS, paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { SaleService } from '../data-access/sale.service';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { SortIconComponent } from '../../../shared/icon/sort-icon.component';
import { CityService } from '../../../core/services/city.service';
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
  selector: 'app-sales-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SaleDetailComponent, PaymentPanelComponent, AutoRefreshControlComponent, SortIconComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, RowLockComponent],
  templateUrl: './sales-page.component.html',
  styleUrl: './sales-page.component.scss',
})
export class SalesPageComponent implements OnInit {
  readonly SALE_STATUSES = SALE_STATUSES;
  readonly SALE_STATUS_LABELS = SALE_STATUS_LABELS;
  readonly PAYMENT_METHODS = PAYMENT_METHODS;
  readonly paymentMethodClass = paymentMethodClass;

  sales = signal<Sale[]>([]);
  summary = signal<SaleSummary>({ tyres_this_month: 0, tyres_today: 0, tyres_period: null, tyres_en_cours: 0, sales_en_cours: 0, unpaid_en_cours: 0, unpaid_livre_monte: 0, ca_avec_facture: 0, ca_sans_facture: 0, filtered_count: 0, filtered_total: 0, filtered_margin: 0 });
  filterOptions = signal<SaleFilters>({ brands: [], clients: [], cities: [], statuses: [], carriers: [], partners: [], payment_statuses: [], commercials: [] });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);

  filterSearch = signal('');
  filterBrand = signal('');
  filterClient = signal('');
  filterCity = signal('');
  cities = signal<string[]>([]);
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterPaymentMethod = signal('');
  filterCarrier = signal('');
  filterPartner = signal('');
  filterCommercial = signal<string>('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  hasDateFilter = computed(() => !!this.filterDateFrom() || !!this.filterDateTo());

  /** Refonte 2b, étape 2 : jetons retirables pour la barre de filtres (recherche exclue, elle a sa propre case). */
  activeFilterChips = computed(() => {
    const chips: { label: string; alert?: boolean; remove: () => void }[] = [];
    const opts = this.filterOptions();

    if (this.filterClient()) chips.push({ label: `Client : ${this.filterClient()}`, remove: () => { this.filterClient.set(''); this.applyFilters(); } });
    if (this.filterCity()) chips.push({ label: this.filterCity(), remove: () => { this.filterCity.set(''); this.applyFilters(); } });
    if (this.filterCommercial()) {
      const name = opts.commercials.find((c: any) => String(c.id) === this.filterCommercial())?.name || this.filterCommercial();
      chips.push({ label: name, remove: () => { this.filterCommercial.set(''); this.applyFilters(); } });
    }
    if (this.filterStatus()) chips.push({ label: this.filterStatus(), remove: () => { this.filterStatus.set(''); this.applyFilters(); } });
    if (this.filterPaymentStatus()) {
      chips.push({
        label: this.filterPaymentStatus(),
        alert: this.filterPaymentStatus() === 'NON PAYE',
        remove: () => { this.filterPaymentStatus.set(''); this.applyFilters(); },
      });
    }
    if (this.filterPaymentMethod()) chips.push({ label: this.filterPaymentMethod(), remove: () => { this.filterPaymentMethod.set(''); this.applyFilters(); } });
    if (this.filterCarrier()) {
      const name = opts.carriers.find((c: any) => String(c.id) === this.filterCarrier())?.name || this.filterCarrier();
      chips.push({ label: name, remove: () => { this.filterCarrier.set(''); this.applyFilters(); } });
    }
    if (this.filterPartner()) {
      const name = opts.partners.find((p: any) => String(p.id) === this.filterPartner())?.name || this.filterPartner();
      chips.push({ label: name, remove: () => { this.filterPartner.set(''); this.applyFilters(); } });
    }
    if (this.filterDateFrom()) chips.push({ label: `Du ${this.filterDateFrom()}`, remove: () => { this.filterDateFrom.set(''); this.applyFilters(); } });
    if (this.filterDateTo()) chips.push({ label: `Au ${this.filterDateTo()}`, remove: () => { this.filterDateTo.set(''); this.applyFilters(); } });
    if (this.filterWithInvoice()) chips.push({ label: this.filterWithInvoice() === '1' ? 'Avec facture' : 'Sans facture', remove: () => { this.filterWithInvoice.set(''); this.applyFilters(); } });
    if (this.filterAmountMin()) chips.push({ label: `Min ${this.filterAmountMin()} DH`, remove: () => { this.filterAmountMin.set(''); this.applyFilters(); } });
    if (this.filterAmountMax()) chips.push({ label: `Max ${this.filterAmountMax()} DH`, remove: () => { this.filterAmountMax.set(''); this.applyFilters(); } });

    return chips;
  });

  /** Compte affiché sur le bouton "Filtres N" : jetons actifs + recherche, si saisie. */
  activeFilterCount = computed(() => this.activeFilterChips().length + (this.filterSearch() ? 1 : 0));

  /** Pied de tableau (refonte 2b) : total et marge de la page affichée — pas de la sélection filtrée entière, calculée côté serveur dans `summary().filtered_total`. */
  pageTotal = computed(() => this.sales().reduce((sum, s) => sum + Number(s.total_sale ?? 0), 0));
  pageMargin = computed(() => this.sales().reduce((sum, s) => sum + Number(s.margin ?? 0), 0));
  filterWithInvoice = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  /** Refonte 2b, étape 2 : panneau des 15 filtres replié par défaut, ouvert par le bouton "Filtres N". */
  filtersExpanded = signal(false);

  loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  /** Nombre de lignes du squelette : la hauteur habituelle d'une page pleine. */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Les filtres actifs, nommés et retirables un par un. Sert au message de
   * liste vide : sans cela il dit « Aucune vente trouvée » sans jamais dire
   * que trois filtres écartent tout le reste.
   */
  readonly activeFilters = computed<ActiveFilter[]>(() =>
    [
      this.filterEntry(this.filterSearch(), `recherche « ${this.filterSearch()} »`, this.filterSearch),
      this.filterEntry(this.filterBrand(), `marque ${this.filterBrand()}`, this.filterBrand),
      this.filterEntry(this.filterClient(), `client ${this.filterClient()}`, this.filterClient),
      this.filterEntry(this.filterCity(), `ville ${this.filterCity()}`, this.filterCity),
      this.filterEntry(
        this.filterStatus(),
        `statut ${(SALE_STATUS_LABELS[this.filterStatus() as SaleStatus] ?? this.filterStatus()).toLowerCase()}`,
        this.filterStatus,
      ),
      this.filterEntry(this.filterPaymentStatus(), this.filterPaymentStatus().toLowerCase(), this.filterPaymentStatus),
      this.filterEntry(this.filterPaymentMethod(), `règlement ${this.filterPaymentMethod().toLowerCase()}`, this.filterPaymentMethod),
      this.filterEntry(this.filterCarrier(), `transporteur ${this.filterCarrier()}`, this.filterCarrier),
      this.filterEntry(this.filterPartner(), `partenaire ${this.filterPartner()}`, this.filterPartner),
      this.filterEntry(this.filterCommercial(), `commercial ${this.filterCommercial()}`, this.filterCommercial),
      this.filterEntry(this.filterDateFrom(), `à partir du ${frenchDate(this.filterDateFrom())}`, this.filterDateFrom),
      this.filterEntry(this.filterDateTo(), `jusqu'au ${frenchDate(this.filterDateTo())}`, this.filterDateTo),
      this.filterEntry(
        this.filterWithInvoice(),
        this.filterWithInvoice() === 'true' ? 'avec facture' : 'sans facture',
        this.filterWithInvoice,
      ),
      this.filterEntry(this.filterAmountMin(), `montant ≥ ${this.filterAmountMin()}`, this.filterAmountMin),
      this.filterEntry(this.filterAmountMax(), `montant ≤ ${this.filterAmountMax()}`, this.filterAmountMax),
    ].filter((entry): entry is ActiveFilter => entry !== null),
  );

  /** Un filtre vide n'est pas un filtre : il ne figure pas dans la liste. */
  private filterEntry(value: string, label: string, target: WritableSignal<string>): ActiveFilter | null {
    if (!value) return null;

    return {
      label,
      clear: () => {
        target.set('');
        this.currentPage.set(1);
        this.loadData();
      },
    };
  }

  isExporting = signal(false);
  exportError = signal('');
  deletingSaleId = signal<number | null>(null);
  detailSale = signal<Sale | null>(null);
  paymentSale = signal<Sale | null>(null);

  /** Précédent / Suivant inside the detail modal — follows the table order across pages. */
  readonly detailNav = new DetailNavigator<Sale>({
    items: this.sales,
    current: this.detailSale,
    page: this.currentPage,
    lastPage: this.lastPage,
    perPage: this.perPage,
    total: this.total,
    loading: this.loading,
    goToPage: (page) => this.goToPage(page),
  });

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  constructor(
    private saleService: SaleService,
    public authService: AuthService,
    private cityService: CityService,
  ) {}

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities.set(cities));
    this.loadFilters();
    this.loadData();

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        if (Number.isFinite(id) && id > 0) {
          this.saleService.getSale(id).subscribe({
            next: sale => this.openDetail(sale),
          });
        }

        // "Valider et encaisser" depuis l'écran plein de saisie (sale-form-page)
        // enchaîne ici : on rouvre directement le panneau de paiement plutôt
        // que de renvoyer au détail. Retire le paramètre de l'URL une fois
        // consommé pour qu'un rafraîchissement de page ne le rouvre pas.
        const payId = Number(params.get('pay'));
        if (Number.isFinite(payId) && payId > 0) {
          this.saleService.getSale(payId).subscribe({
            next: sale => this.openPayments(sale),
          });
          this.router.navigate([], { queryParams: { pay: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
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
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
        this.detailNav.onListLoaded();
      },
      error: (err) => {
        // On garde les lignes déjà affichées : l'écran d'erreur dit ce qui a
        // échoué et de quand datent les données encore à l'écran, plutôt que
        // de tout effacer sous les yeux de l'utilisateur.
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
        this.detailNav.reset();
      },
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
      payment_method: this.filterPaymentMethod(),
      carrier_id: this.filterCarrier(),
      partner_id: this.filterPartner(),
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
    this.filterPaymentMethod.set('');
    this.filterCarrier.set('');
    this.filterPartner.set('');
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

  openDetail(sale: Sale): void {
    this.detailSale.set(sale);
  }

  getClientName(sale: Sale): string {
    return sale.linked_client?.name?.trim() || sale.client || '-';
  }

  getClientPhone(sale: Sale): string {
    return sale.linked_client?.phone?.trim() || sale.client_phone || '';
  }

  getClientCity(sale: Sale): string {
    return sale.linked_client?.city?.trim() || '';
  }

  /** Refonte 2b, étape 2 : sous-ligne de qualifiants (ville, téléphone, commercial, partenaire, mode de paiement). */
  subLineFor(sale: Sale): string {
    const parts = [
      this.getClientCity(sale),
      this.getClientPhone(sale),
      sale.commercial?.name,
      sale.partner?.name,
      sale.payment_methods?.length ? sale.payment_methods.join(', ') : null,
    ].filter((p): p is string => !!p);
    return parts.join(' · ');
  }

  closeDetail(): void {
    this.detailSale.set(null);
    this.detailNav.reset();
  }

  /** La modification se fait maintenant sur l'écran plein /sales/:id/edit (sale-form-page), pas dans une modale ici. */
  editFromDetail(): void {
    const sale = this.detailSale();
    if (!sale) return;
    this.closeDetail();
    this.router.navigate(['/sales', sale.id, 'edit']);
  }

  deleteSale(sale: Sale): void {
    const productLabel = `${sale.total_quantity} article(s)`;
    if (confirm(`Voulez-vous vraiment supprimer cette vente ?\nClient: ${this.getClientName(sale)} - Produit: ${productLabel}`)) {
      this.deletingSaleId.set(sale.id);
      this.saleService.deleteSale(sale.id).subscribe({
        next: () => {
          this.deletingSaleId.set(null);
          this.loadData();
          this.loadFilters();
        },
        error: () => {
          this.deletingSaleId.set(null);
          alert('Erreur lors de la suppression de la vente');
        },
      });
    }
  }

  exportSales(): void {
    this.isExporting.set(true);
    this.exportError.set('');
    const filters = this.buildFilters();
    delete filters['page'];
    delete filters['per_page'];
    this.saleService.exportSales(filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventes-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => {
        this.exportError.set("L'export des ventes a échoué. Veuillez réessayer.");
        this.isExporting.set(false);
      },
    });
  }

  isSaleLocked(sale: Sale): boolean {
    return sale.status === 'TERMINEE' && !this.authService.hasRole('Administrator');
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

    const oldStatus = sale.status;
    sale.status = newStatus;

    this.saleService.patchStatus(sale.id, newStatus as SaleStatus).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err: any) => {
        sale.status = oldStatus;
        const msg = err?.error?.errors?.status?.[0] || err?.error?.message || 'Erreur lors de la mise à jour du statut.';
        alert(msg);
      }
    });
  }

  /** Current status kept first (so it stays selected) followed by the statuses it can legally move to. */
  statusOptionsFor(sale: Sale): SaleStatus[] {
    const current = sale.status as SaleStatus;
    return [current, ...(SALE_STATUS_TRANSITIONS[current] || [])];
  }

  marginPct(sale: Sale): number {
    const base = Number(sale.total_sale ?? 0);
    if (!base) return 0;
    return (Number(sale.margin ?? 0) / base) * 100;
  }

  marginClass(sale: Sale): string {
    const pct = this.marginPct(sale);
    if (pct > 20) return 'margin-high';
    if (pct > 10) return 'margin-mid';
    return 'margin-low';
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
