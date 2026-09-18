import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StockService } from '../data-access/stock.service';
import { Stock, StockFilters, StockGroup, StockLot, StockMovement, StockSummary } from '../models/stock.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { SortIconComponent } from '../../../shared/icon/sort-icon.component';
import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AutoRefreshControlComponent, SortIconComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent],
  templateUrl: './stock-page.component.html',
  styleUrl: './stock-page.component.scss',
})
export class StockPageComponent implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  stocks = signal<Stock[]>([]);

  // ── Refonte 2b : une ligne par référence, lots dépliables ──────────────────
  readonly groups = signal<StockGroup[]>([]);
  readonly expandedProducts = signal<Set<number>>(new Set());
  /** Libellé de la référence affiché dans l'entête de l'historique. */
  readonly selectedStockLabel = signal('');
  readonly showFilters = signal(false);
  readonly filterLowStock = signal(false);
  readonly filterDormant = signal(false);
  movements = signal<StockMovement[]>([]);
  filterOptions = signal<StockFilters>({
    brands: [],
    depots: [],
    zones: [],
    countries: [],
  });
  summary = signal<StockSummary>({
    total_articles: 0,
    total_quantity: 0,
    total_purchase_value: 0,
  });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  searchQuery = signal('');
  filterBrand = signal('');
  filterDepot = signal('');
  filterCountry = signal('');
  filterInStock = signal(true);

  filterRunFlat = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Refonte 2b : tant que le résumé n'est pas revenu, les cadrans affichent
   * « — » et non 0. Un 0 affirme un chiffre — « CA du jour : 0,00 DH » — que
   * l'on n'a pas encore, et qui restait affiché si la requête échouait.
   */
  readonly summaryLoaded = signal(false);

  /**
   * « En stock » est coché par défaut : c'est le filtre qui surprend le plus
   * quand une référence connue n'apparaît pas. Il figure donc dans la liste au
   * même titre que les autres.
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

    if (this.searchQuery()) drop(`recherche « ${this.searchQuery()} »`, () => this.searchQuery.set(''));
    if (this.filterBrand()) drop(`marque ${this.filterBrand()}`, () => this.filterBrand.set(''));
    if (this.filterDepot()) drop(`dépôt ${this.filterDepot()}`, () => this.filterDepot.set(''));
    if (this.filterCountry()) drop(`origine ${this.filterCountry()}`, () => this.filterCountry.set(''));
    if (this.filterInStock()) drop('en stock uniquement', () => this.filterInStock.set(false));
    if (this.filterRunFlat()) drop('run-flat', () => this.filterRunFlat.set(false));
    if (this.filterLowStock()) drop('sous seuil', () => this.filterLowStock.set(false));
    if (this.filterDormant()) drop('dormant', () => this.filterDormant.set(false));

    return applied;
  });

  /**
   * « Tout effacer » depuis la liste vide. Distinct de `resetFilters()`, qui
   * remet « en stock » à coché : ici on a promis de tout retirer.
   */
  clearAllFilters(): void {
    this.resetFilters();
    this.filterInStock.set(false);
    this.loadData();
  }

  sortBy = signal<'quantity' | 'value'>('value');
  sortDirection = signal<'asc' | 'desc'>('desc');

  loading = signal(false);
  loadingSummary = signal(false);
  isExporting = false;
  exportError = '';

  showMovementsModal = signal(false);
  movementsLoading = signal(false);
  movementsError = signal('');
  selectedStock = signal<Stock | null>(null);

  showEditModal = signal(false);
  editingStock = signal<Stock | null>(null);
  editQuantity = signal<number | null>(null);
  editPurchasePrice = signal<number | null>(null);
  editDepot = signal('');
  editZone = signal('');
  editMadeIn = signal('');
  editDot = signal('');
  editReason = signal('');
  editLoading = signal(false);
  editError = signal('');

  readonly searchHint = computed(() => {
    const q = this.searchQuery().trim();
    if (!q) return '';
    const m = q.match(/^(\d{2,3})\/?(\d{2,3})?[A-Z]*R(\d{2,3})/i)
      ?? q.match(/^[A-Za-z]*(\d{3})(\d{2})(\d{2,3})$/);
    if (!m) {
      const pure = q.match(/^(\d{3})(\d{2})(\d{2,3})$/);
      if (pure) return `${pure[1]} / ${pure[2]} R${pure[3]}`;
      return '';
    }
    const [, w, h, d] = m;
    let hint = w;
    if (h) hint += ` / ${h}`;
    if (d) hint += ` R${d}`;
    return hint;
  });

  readonly totalPurchaseValueFormatted = computed(() =>
    new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.summary().total_purchase_value || 0),
  );

  ngOnInit(): void {
    this.loadFilters();

    // Permet d'arriver ici depuis un lien portant la recherche — la palette de
    // commandes s'en sert pour ouvrir une dimension. Même motif que
    // products-page, qui acceptait déjà ?search=.
    const search = this.route.snapshot.queryParamMap.get('search');
    if (search) {
      this.searchQuery.set(search);
      // Une dimension cherchée depuis ailleurs doit se trouver même si le lot
      // est à zéro : on ne présume pas qu'elle est en stock.
      this.filterInStock.set(false);
    }

    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.loadingSummary.set(true);
    const filters = this.buildFilters();

    this.stockService.getGrouped(filters).subscribe({
      next: (response) => {
        this.groups.set(response.data ?? []);
        this.currentPage.set(Number(response.current_page ?? 1) || 1);
        this.lastPage.set(Number(response.last_page ?? 1) || 1);
        this.total.set(Number(response.total ?? 0) || 0);
        this.loading.set(false);
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });

    this.stockService.getSummary(filters).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoaded.set(true);
        this.loadingSummary.set(false);
      },
      // On ne remet plus de zéros : c'était affirmer un stock vide alors que
      // la requête a seulement échoué.
      error: () => {
        this.summaryLoaded.set(false);
        this.loadingSummary.set(false);
      },
    });
  }

  loadFilters(): void {
    this.stockService.getFilters().subscribe({
      next: (filters) => this.filterOptions.set(filters),
    });
  }

  private buildFilters(): Record<string, string> {
    const filters: Record<string, string> = {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };

    if (this.searchQuery().trim()) {
      filters['search'] = this.searchQuery().trim();
    }

    if (this.filterBrand()) {
      filters['brand'] = this.filterBrand();
    }

    if (this.filterDepot()) {
      filters['depot'] = this.filterDepot();
    }

    if (this.filterCountry()) {
      filters['made_in'] = this.filterCountry();
    }

    if (this.filterInStock()) {
      filters['in_stock'] = '1';
    }

    if (this.filterRunFlat()) {
      filters['rft'] = '1';
    }

    if (this.filterLowStock()) {
      filters['low_stock'] = '1';
    }

    if (this.filterDormant()) {
      filters['dormant'] = '1';
    }

    return filters;
  }

  search(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterBrand.set('');
    this.filterDepot.set('');
    this.filterCountry.set('');
    this.filterInStock.set(true);
    this.filterRunFlat.set(false);
    this.filterLowStock.set(false);
    this.filterDormant.set(false);
    this.sortBy.set('value');
    this.sortDirection.set('desc');
    this.currentPage.set(1);
    this.loadData();
  }

  toggleSort(column: 'quantity' | 'value'): void {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set('desc');
    }

    this.currentPage.set(1);
    this.loadData();
  }

  private stockLabel(stock: Stock): string {
    return [stock.product?.reference, stock.product?.brand?.name, stock.product?.profile]
      .filter(Boolean)
      .join(' — ');
  }

  toggleGroup(productId: number): void {
    this.expandedProducts.update((set) => {
      const next = new Set(set);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      return next;
    });
  }

  isExpanded(productId: number): boolean {
    return this.expandedProducts().has(productId);
  }

  /** « Sous seuil » se lit sur les ventes réelles : il reste moins que ce qui part en un mois. */
  isLowStock(group: StockGroup): boolean {
    return group.sold_30d > 0 && group.quantity < group.sold_30d;
  }

  /** Dormant : rien de vendu depuis six mois alors qu'il reste du stock. */
  isDormant(group: StockGroup): boolean {
    return group.sold_180d === 0 && group.quantity > 0;
  }

  /** Part du stock détenue par le dépôt le mieux pourvu, pour la jauge de répartition. */
  depotShare(group: StockGroup, quantity: number): number {
    return group.quantity > 0 ? (quantity / group.quantity) * 100 : 0;
  }

  toggleLowStockFilter(): void {
    this.filterLowStock.update((v) => !v);
    if (this.filterLowStock()) this.filterDormant.set(false);
    this.currentPage.set(1);
    this.loadData();
  }

  toggleDormantFilter(): void {
    this.filterDormant.update((v) => !v);
    if (this.filterDormant()) this.filterLowStock.set(false);
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  exportAvailableStock(): void {
    this.isExporting = true;
    this.exportError = '';

    const exportFilters = this.buildFilters();
    exportFilters['in_stock'] = '1';

    this.stockService
      .exportAvailableStock(exportFilters)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

          link.href = url;
          link.download = `stock-disponible-${timestamp}.xlsx`;
          link.click();

          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.exportError = "L'export du stock a échoué. Veuillez réessayer.";
        },
      });
  }

  openEditModal(stock: Stock | StockLot): void {
    this.editingStock.set(stock as Stock);
    this.editQuantity.set(stock.quantity);
    this.editPurchasePrice.set(stock.purchase_price);
    this.editDepot.set(stock.depot ?? '');
    this.editZone.set(stock.zone ?? '');
    this.editMadeIn.set(stock.made_in ?? '');
    this.editDot.set(stock.dot ?? '');
    this.editReason.set('');
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingStock.set(null);
    this.editError.set('');
    this.editLoading.set(false);
  }

  submitEdit(): void {
    const stock = this.editingStock();
    if (!stock) return;

    const newQuantity = this.editQuantity() ?? stock.quantity;
    const quantityChanged = newQuantity !== stock.quantity;
    const reason = this.editReason().trim();

    if (quantityChanged && reason.length < 3) {
      this.editError.set('Le motif est obligatoire lorsque la quantité change (3 caractères minimum).');
      return;
    }

    const payload: Record<string, unknown> = {
      quantity: newQuantity,
      purchase_price: this.editPurchasePrice(),
      depot: this.editDepot() || null,
      zone: this.editZone() || null,
      made_in: this.editMadeIn() || null,
      dot: this.editDot() || null,
      reason: reason || null,
    };

    this.editLoading.set(true);
    this.editError.set('');

    this.stockService.updateStock(stock.id, payload).subscribe({
      next: (updated) => {
        this.editLoading.set(false);
        this.closeEditModal();
        this.loadData();
      },
      error: (err) => {
        const errors = err?.error?.errors;
        const first = errors ? Object.values(errors)[0] : null;
        const msg =
          (Array.isArray(first) ? first[0] : null) ||
          err?.error?.message ||
          'Une erreur est survenue.';
        this.editError.set(msg as string);
        this.editLoading.set(false);
      },
    });
  }

  /**
   * L'historique porte sur la référence : un lot seul n'a pas de product_id
   * (il est imbriqué sous sa référence), on le reçoit donc du groupe.
   */
  openMovementsModal(stock: Stock | StockLot, productId?: number, label?: string): void {
    const resolvedProductId = productId ?? (stock as Stock).product_id;
    if (!resolvedProductId) {
      return;
    }

    this.selectedStock.set(stock as Stock);
    this.selectedStockLabel.set(label ?? this.stockLabel(stock as Stock));
    this.showMovementsModal.set(true);
    this.movementsLoading.set(true);
    this.movementsError.set('');
    this.movements.set([]);

    this.stockService
      .getStockMovements({
        product_id: resolvedProductId.toString(),
        per_page: '10',
      })
      .subscribe({
        next: (response) => {
          this.movements.set(response.data ?? []);
          this.movementsLoading.set(false);
        },
        error: () => {
          this.movementsError.set("Impossible de charger l'historique des mouvements.");
          this.movementsLoading.set(false);
        },
      });
  }

  closeMovementsModal(): void {
    this.showMovementsModal.set(false);
    this.selectedStock.set(null);
    this.movements.set([]);
    this.movementsError.set('');
    this.movementsLoading.set(false);
  }

  dimensionsLabel(stock: Stock): string {
    const tyre = stock.product?.tyre;
    if (!tyre?.tire_width) {
      return '-';
    }

    return `${tyre.tire_width}/${tyre.tire_height}R${tyre.tire_diameter}`;
  }

  markingLabel(stock: Stock): string {
    const tyre = stock.product?.tyre;
    const tags: string[] = [];

    if (tyre?.tire_marking) {
      tags.push(tyre.tire_marking);
    }

    if (tyre?.tire_runflat) {
      tags.push('RFT');
    }

    if (tyre?.tire_reinforced) {
      tags.push('XL');
    }

    return tags.join(' • ') || '-';
  }

  movementTypeLabel(type: string | null | undefined): string {
    switch (type) {
      case 'initial':
        return 'Initial';
      case 'adjustment':
        return 'Ajustement';
      case 'deletion':
        return 'Suppression';
      case 'import':
        return 'Import';
      case 'sale':
        return 'Vente';
      case 'purchase':
        return 'Achat';
      default:
        return type || '-';
    }
  }

  movementQuantityLabel(movement: StockMovement): string {
    if (movement.quantity_change !== null && movement.quantity_change !== undefined) {
      return `${movement.quantity_change > 0 ? '+' : ''}${movement.quantity_change}`;
    }

    if (movement.quantity_after !== null && movement.quantity_after !== undefined) {
      return `${movement.quantity_after}`;
    }

    return '-';
  }

  movementLocationLabel(movement: StockMovement): string {
    const depot = movement.stock?.depot;
    const zone = movement.stock?.zone;

    if (depot && zone) {
      return `${depot} / ${zone}`;
    }

    return depot || zone || '-';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-MA', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  get pages(): number[] {
    const totalPages = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    return pages;
  }
}
