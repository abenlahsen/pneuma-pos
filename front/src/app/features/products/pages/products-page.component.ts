import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../data-access/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, ProductFilters, ProductPayload } from '../models/product.model';
import { ProductFormComponent } from '../product-form/product-form.component';
import { ProductDetailComponent } from '../product-detail/product-detail.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent, ProductDetailComponent, AutoRefreshControlComponent],
  templateUrl: './products-page.component.html',
  styleUrls: ['./products-page.component.scss'],
})
export class ProductsPageComponent implements OnInit {
  products = signal<Product[]>([]);
  filterOptions = signal<ProductFilters>({
    brands: [],
    types: [],
    seasons: [],
    units: [],
    part_categories: [],
    service_categories: [],
    profiles: [],
  });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  searchQuery = signal('');
  filterType = signal('');
  filterBrand = signal('');
  filterProfile = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  loading = signal(false);
  showForm = signal(false);
  editingProduct = signal<Product | null>(null);
  viewingProduct = signal<Product | null>(null);

  private resetting = false;

  constructor(
    private productService: ProductService,
    public authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    const search = this.route.snapshot.queryParamMap.get('search');
    if (search) {
      this.searchQuery.set(search);
    }
    this.loadData();

    const productId = Number(this.route.snapshot.queryParamMap.get('id'));
    if (productId) {
      const editMode = this.route.snapshot.queryParamMap.get('edit') === '1';
      this.productService.getProduct(productId).subscribe({
        next: (product) => editMode ? this.openEditForm(product) : this.openViewModal(product),
      });
    }
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.productService.getProducts(filters).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.currentPage.set(Number(response.current_page ?? 1) || 1);
        this.lastPage.set(Number(response.last_page ?? 1) || 1);
        this.total.set(Number(response.total ?? 0) || 0);
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

    if (this.searchQuery()) {
      filters['search'] = this.searchQuery();
    }

    if (this.filterType()) {
      filters['type'] = this.filterType();
    }

    if (this.filterBrand()) {
      filters['brand_id'] = this.filterBrand();
    }

    if (this.filterProfile()) {
      filters['profile'] = this.filterProfile();
    }

    return filters;
  }

  search(): void {
    this.currentPage.set(1);
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.loadData();
  }

  applyFilters(): void {
    if (this.resetting) {
      return;
    }

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
    this.filterProfile.set('');
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

  openViewModal(product: Product): void {
    this.viewingProduct.set(product);
  }

  closeViewModal(): void {
    this.viewingProduct.set(null);
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
    const label =
      [product.brand?.name, product.profile, product.reference].filter(Boolean).join(' — ') ||
      `Produit #${product.id}`;

    if (confirm(`Supprimer le produit "${label}" ?`)) {
      this.productService.deleteProduct(product.id).subscribe({
        next: () => {
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  seasonLabel(season: string | null | undefined): string {
    switch (season) {
      case 'summer':
        return 'Été';
      case 'winter':
        return 'Hiver';
      case 'all_season':
        return '4 Saisons';
      default:
        return '-';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'tyre':
        return 'Pneu';
      case 'part':
        return 'Pièce';
      case 'service':
        return 'Service';
      default:
        return type;
    }
  }

  partCategoryLabel(category: string | null | undefined): string {
    switch (category) {
      case 'brakes':
        return 'Freinage';
      case 'lubricants':
        return 'Lubrifiants';
      case 'engine':
        return 'Moteur';
      case 'suspension':
        return 'Suspension';
      case 'filters':
        return 'Filtres';
      case 'electrical':
        return 'Électrique';
      case 'body':
        return 'Carrosserie';
      case 'other':
        return 'Autre';
      default:
        return category || '-';
    }
  }

  serviceCategoryLabel(category: string | null | undefined): string {
    switch (category) {
      case 'mechanical':
        return 'Mécanique';
      case 'oil':
        return 'Vidange';
      case 'tires':
        return 'Pneumatique';
      case 'bodywork':
        return 'Carrosserie';
      case 'diagnostic':
        return 'Diagnostic';
      case 'other':
        return 'Autre';
      default:
        return category || '-';
    }
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