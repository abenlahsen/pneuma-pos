import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { AuthService } from '../../core/services/auth.service';
import { Stock, StockPayload, StockSummary, StockFilters, ParsedDimension } from '../../core/models/stock.model';
import { PaginatedResponse } from '../../core/models/sale.model';
import { StockFormComponent } from './stock-form/stock-form.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, StockFormComponent],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss',
})
export class StockComponent implements OnInit {
  // Data
  stocks = signal<Stock[]>([]);
  summary = signal<StockSummary>({ total_articles: 0, total_quantity: 0, total_purchase_value: 0, total_selling_value: 0 });
  filterOptions = signal<StockFilters>({ brands: [], depots: [], zones: [], countries: [] });

  // Pagination
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(50);

  // Search & Filters
  searchQuery = signal('');
  filterBrand = signal('');
  filterDepot = signal('');
  filterMadeIn = signal('');
  filterInStock = signal(false);
  filterRft = signal(false);
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // UI state
  loading = signal(false);
  showForm = signal(false);
  editingStock = signal<Stock | null>(null);
  importing = signal(false);
  private resetting = false;

  // Search hint — parses the search query client-side to show dimension hint
  searchHint = computed(() => {
    const parsed = this.parseSearchQuery(this.searchQuery());
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
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.stockService.getStocks(filters).subscribe({
      next: (response) => {
        this.stocks.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.stockService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
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
    if (this.searchQuery()) filters['search'] = this.searchQuery();
    if (this.filterBrand()) filters['brand'] = this.filterBrand();
    if (this.filterDepot()) filters['depot'] = this.filterDepot();
    if (this.filterMadeIn()) filters['made_in'] = this.filterMadeIn();
    if (this.filterInStock()) filters['in_stock'] = '1';
    if (this.filterRft()) filters['rft'] = '1';
    return filters;
  }

  search(): void {
    this.currentPage.set(1);
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.loadData();
  }

  applyFilters(): void {
    if (this.resetting) return;
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
    this.resetting = true;
    this.searchQuery.set('');
    this.filterBrand.set('');
    this.filterDepot.set('');
    this.filterMadeIn.set('');
    this.filterInStock.set(false);
    this.filterRft.set(false);
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.resetting = false;
    this.loadFilters();
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openAddForm(): void {
    this.editingStock.set(null);
    this.showForm.set(true);
  }

  openEditForm(stock: Stock): void {
    this.editingStock.set(stock);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingStock.set(null);
  }

  onFormSubmit(payload: StockPayload): void {
    const editing = this.editingStock();
    if (editing) {
      this.stockService.updateStock(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    } else {
      this.stockService.createStock(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  deleteStock(stock: Stock): void {
    if (confirm(`Supprimer cet article ?\n${stock.brand} ${stock.dimension}`)) {
      this.stockService.deleteStock(stock.id).subscribe({
        next: () => {
          this.loadData();
          this.loadFilters();
        },
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
        this.loadData();
        this.loadFilters();
        input.value = '';
      },
      error: () => {
        this.importing.set(false);
        alert('Erreur lors de l\'import.');
        input.value = '';
      },
    });
  }

  /** Client-side search query parser — mirrors backend logic for hint display */
  private parseSearchQuery(input: string): ParsedDimension {
    const tokens = input.trim().split(/\s+/);
    const result: ParsedDimension = { width: null, height: null, diameter: null, text: [] };

    for (const token of tokens) {
      if (!token) continue;

      // Formatted dimension: 205/55R16
      const dimMatch = token.match(/^(\d{2,3})\/?(\d{2,3})?[A-Z]*R(\d{2,3})/i);
      if (dimMatch) {
        result.width = parseInt(dimMatch[1]);
        result.height = dimMatch[2] ? parseInt(dimMatch[2]) : null;
        result.diameter = parseInt(dimMatch[3]);
        continue;
      }

      // Pure digits
      if (/^\d+$/.test(token)) {
        const len = token.length;
        if (len >= 7) {
          result.width = parseInt(token.substring(0, 3));
          result.height = parseInt(token.substring(3, 5));
          result.diameter = parseInt(token.substring(5));
        } else if (len >= 5) {
          result.width = parseInt(token.substring(0, 3));
          result.height = parseInt(token.substring(3, 5));
        } else if (len === 3) {
          result.width = parseInt(token);
        } else if (len === 2) {
          result.diameter = parseInt(token);
        }
        continue;
      }

      result.text.push(token);
    }

    return result;
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
