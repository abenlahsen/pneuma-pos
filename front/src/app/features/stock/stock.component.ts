import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { AuthService } from '../../core/services/auth.service';
import { Stock, StockPayload, StockSummary, StockFilters, ParsedDimension } from '../../core/models/stock.model';
import { StockFormComponent } from '../products/stock-form/stock-form.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, StockFormComponent],
  templateUrl: './stock.component.html',
  styleUrls: ['../sales/sales.component.scss', '../products/products.component.scss'],
})
export class StockComponent implements OnInit {
  stocks = signal<Stock[]>([]);
  stockSummary = signal<StockSummary>({ total_articles: 0, total_quantity: 0, total_purchase_value: 0 });
  stockFilterOptions = signal<StockFilters>({ brands: [], depots: [], zones: [], countries: [] });
  stockCurrentPage = signal(1);
  stockLastPage = signal(1);
  stockTotal = signal(0);
  stockPerPage = signal(50);
  stockSearchQuery = signal('');
  stockFilterBrand = signal('');
  stockFilterDepot = signal('');
  stockFilterMadeIn = signal('');
  stockFilterInStock = signal(false);
  stockFilterRft = signal(false);
  stockSortBy = signal('');
  stockSortDirection = signal<'asc' | 'desc'>('asc');
  stockLoading = signal(false);
  showStockForm = signal(false);
  editingStock = signal<Stock | null>(null);
  importing = signal(false);
  private stockResetting = false;

  stockSearchHint = computed(() => {
    const parsed = this.parseSearchQuery(this.stockSearchQuery());
    if (!parsed.width && !parsed.height && !parsed.diameter) return '';
    let hint = '';
    if (parsed.width) hint += parsed.width;
    if (parsed.height) hint += ' / ' + parsed.height;
    if (parsed.diameter) hint += ' R ' + parsed.diameter;
    return hint.trim();
  });

  constructor(
    private stockService: StockService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadStockFilters();
    this.loadStockData();
  }

  loadStockData(): void {
    this.stockLoading.set(true);
    const filters = this.buildStockFilters();

    this.stockService.getStocks(filters).subscribe({
      next: (response) => {
        this.stocks.set(response.data);
        this.stockCurrentPage.set(response.current_page);
        this.stockLastPage.set(response.last_page);
        this.stockTotal.set(response.total);
        this.stockLoading.set(false);
      },
      error: () => this.stockLoading.set(false),
    });

    this.stockService.getSummary(filters).subscribe({
      next: (summary) => this.stockSummary.set(summary),
    });
  }

  loadStockFilters(): void {
    this.stockService.getFilters().subscribe({
      next: (filters) => this.stockFilterOptions.set(filters),
    });
  }

  private buildStockFilters(): Record<string, string> {
    const filters: Record<string, string> = {
      page: this.stockCurrentPage().toString(),
      per_page: this.stockPerPage().toString(),
      sort_by: this.stockSortBy(),
      sort_direction: this.stockSortDirection(),
    };
    if (this.stockSearchQuery()) filters['search'] = this.stockSearchQuery();
    if (this.stockFilterBrand()) filters['brand'] = this.stockFilterBrand();
    if (this.stockFilterDepot()) filters['depot'] = this.stockFilterDepot();
    if (this.stockFilterMadeIn()) filters['made_in'] = this.stockFilterMadeIn();
    if (this.stockFilterInStock()) filters['in_stock'] = '1';
    if (this.stockFilterRft()) filters['rft'] = '1';
    return filters;
  }

  stockSearch(): void {
    this.stockCurrentPage.set(1);
    this.stockSortBy.set('');
    this.stockSortDirection.set('asc');
    this.loadStockData();
  }

  stockApplyFilters(): void {
    if (this.stockResetting) return;
    this.stockCurrentPage.set(1);
    this.loadStockData();
  }

  stockToggleSort(column: string): void {
    if (this.stockSortBy() === column) {
      this.stockSortDirection.set(this.stockSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.stockSortBy.set(column);
      this.stockSortDirection.set('asc');
    }
    this.stockCurrentPage.set(1);
    this.loadStockData();
  }

  stockResetFilters(): void {
    this.stockResetting = true;
    this.stockSearchQuery.set('');
    this.stockFilterBrand.set('');
    this.stockFilterDepot.set('');
    this.stockFilterMadeIn.set('');
    this.stockFilterInStock.set(false);
    this.stockFilterRft.set(false);
    this.stockSortBy.set('');
    this.stockSortDirection.set('asc');
    this.stockCurrentPage.set(1);
    this.stockResetting = false;
    this.loadStockFilters();
    this.loadStockData();
  }

  stockGoToPage(page: number): void {
    if (page >= 1 && page <= this.stockLastPage()) {
      this.stockCurrentPage.set(page);
      this.loadStockData();
    }
  }

  openAddStockForm(): void {
    this.editingStock.set(null);
    this.showStockForm.set(true);
  }

  openEditStockForm(stock: Stock): void {
    this.editingStock.set(stock);
    this.showStockForm.set(true);
  }

  closeStockForm(): void {
    this.showStockForm.set(false);
    this.editingStock.set(null);
  }

  onStockFormSubmit(payload: StockPayload): void {
    const editing = this.editingStock();
    if (editing) {
      this.stockService.updateStock(editing.id, payload).subscribe({
        next: () => { this.closeStockForm(); this.loadStockData(); this.loadStockFilters(); },
      });
    } else {
      this.stockService.createStock(payload).subscribe({
        next: () => { this.closeStockForm(); this.loadStockData(); this.loadStockFilters(); },
      });
    }
  }

  deleteStock(stock: Stock): void {
    const label = stock.product
      ? [stock.product.brand?.name, stock.product.profile, stock.product.tire_width ? `${stock.product.tire_width}/${stock.product.tire_height}R${stock.product.tire_diameter}` : ''].filter(Boolean).join(' — ')
      : `Stock #${stock.id}`;
    const name = label || `Stock #${stock.id}`;
    if (confirm(`Supprimer cet article ?\n${name}`)) {
      this.stockService.deleteStock(stock.id).subscribe({
        next: () => { this.loadStockData(); this.loadStockFilters(); },
      });
    }
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.importing.set(true);
    this.stockService.importStock(file).subscribe({
      next: (result) => {
        this.importing.set(false);
        alert(result.message);
        this.loadStockData();
        this.loadStockFilters();
        input.value = '';
      },
      error: () => {
        this.importing.set(false);
        alert('Erreur lors de l\'import.');
        input.value = '';
      },
    });
  }

  private parseSearchQuery(input: string): ParsedDimension {
    const tokens = input.trim().split(/\s+/);
    const result: ParsedDimension = { width: null, height: null, diameter: null, text: [] };
    for (const token of tokens) {
      if (!token) continue;
      const dimMatch = token.match(/^(\d{2,3})\/(\d{2,3})?[A-Z]*R(\d{2,3})/i);
      if (dimMatch) {
        result.width = parseInt(dimMatch[1]);
        result.height = dimMatch[2] ? parseInt(dimMatch[2]) : null;
        result.diameter = parseInt(dimMatch[3]);
        continue;
      }
      if (/^\d+$/.test(token)) {
        const len = token.length;
        if (len >= 7) { result.width = parseInt(token.substring(0, 3)); result.height = parseInt(token.substring(3, 5)); result.diameter = parseInt(token.substring(5)); }
        else if (len >= 5) { result.width = parseInt(token.substring(0, 3)); result.height = parseInt(token.substring(3, 5)); }
        else if (len === 3) { result.width = parseInt(token); }
        else if (len === 2) { result.diameter = parseInt(token); }
        continue;
      }
      result.text.push(token);
    }
    return result;
  }

  get stockPages(): number[] {
    const total = this.stockLastPage();
    const current = this.stockCurrentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
