import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { StockService } from '../data-access/stock.service';
import { Stock, StockFilters, StockMovement, StockSummary } from '../models/stock.model';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-page.component.html',
  styleUrl: './stock-page.component.scss',
})
export class StockPageComponent implements OnInit {
  private readonly stockService = inject(StockService);

  stocks = signal<Stock[]>([]);
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

  sortBy = signal<'quantity' | 'purchase_price' | 'depot' | 'created_at'>('quantity');
  sortDirection = signal<'asc' | 'desc'>('desc');

  loading = signal(false);
  loadingSummary = signal(false);
  isExporting = false;
  exportError = '';

  showMovementsModal = signal(false);
  movementsLoading = signal(false);
  movementsError = signal('');
  selectedStock = signal<Stock | null>(null);

  readonly totalPurchaseValueFormatted = computed(() =>
    new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.summary().total_purchase_value || 0),
  );

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.loadingSummary.set(true);
    const filters = this.buildFilters();

    this.stockService.getStocks(filters).subscribe({
      next: (response) => {
        this.stocks.set(response.data ?? []);
        this.currentPage.set(Number(response.current_page ?? 1) || 1);
        this.lastPage.set(Number(response.last_page ?? 1) || 1);
        this.total.set(Number(response.total ?? 0) || 0);
        this.loading.set(false);
      },
      error: () => {
        this.stocks.set([]);
        this.loading.set(false);
      },
    });

    this.stockService.getSummary(filters).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loadingSummary.set(false);
      },
      error: () => {
        this.summary.set({
          total_articles: 0,
          total_quantity: 0,
          total_purchase_value: 0,
        });
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
    this.sortBy.set('quantity');
    this.sortDirection.set('desc');
    this.currentPage.set(1);
    this.loadData();
  }

  toggleSort(column: 'quantity' | 'purchase_price' | 'depot' | 'created_at'): void {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set(column === 'quantity' ? 'desc' : 'asc');
    }

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

  openMovementsModal(stock: Stock): void {
    if (!stock.product_id) {
      return;
    }

    this.selectedStock.set(stock);
    this.showMovementsModal.set(true);
    this.movementsLoading.set(true);
    this.movementsError.set('');
    this.movements.set([]);

    this.stockService
      .getStockMovements({
        product_id: stock.product_id.toString(),
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
