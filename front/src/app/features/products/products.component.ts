import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, ProductPayload, ProductFilters } from '../../core/models/product.model';
import { ProductFormComponent } from './product-form/product-form.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  products = signal<Product[]>([]);
  filterOptions = signal<ProductFilters>({ brands: [], types: [], seasons: [], units: [] });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  searchQuery = signal('');
  filterType = signal('');
  filterBrand = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  loading = signal(false);
  showForm = signal(false);
  editingProduct = signal<Product | null>(null);
  private resetting = false;

  constructor(
    private productService: ProductService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.productService.getProducts(filters).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadFilters(): void {
    this.productService.getFilters().subscribe({
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
    if (this.filterType()) filters['type'] = this.filterType();
    if (this.filterBrand()) filters['brand_id'] = this.filterBrand();
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
    this.filterType.set('');
    this.filterBrand.set('');
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.resetting = false;
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openAddForm(): void {
    this.editingProduct.set(null);
    this.showForm.set(true);
  }

  openEditForm(product: Product): void {
    this.editingProduct.set(product);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingProduct.set(null);
  }

  onFormSubmit(payload: ProductPayload): void {
    const editing = this.editingProduct();
    if (editing) {
      this.productService.updateProduct(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    } else {
      this.productService.createProduct(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  toggleActive(product: Product): void {
    this.productService.toggleActive(product.id).subscribe({
      next: () => this.loadData(),
    });
  }

  deleteProduct(product: Product): void {
    const label = [product.brand?.name, product.profile, product.reference].filter(Boolean).join(' — ') || `Produit #${product.id}`;
    if (confirm(`Supprimer le produit "${label}" ?`)) {
      this.productService.deleteProduct(product.id).subscribe({
        next: () => {
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  seasonLabel(season: string | null): string {
    switch (season) {
      case 'summer': return 'Été';
      case 'winter': return 'Hiver';
      case 'all_season': return '4 Saisons';
      default: return '-';
    }
  }

  typeLabel(type: string): string {
    return type === 'tyre' ? 'Pneu' : 'Pièce';
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
