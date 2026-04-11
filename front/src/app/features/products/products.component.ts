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
  styleUrls: ['../sales/sales.component.scss', './products.component.scss'],
})
export class ProductsComponent implements OnInit {
  products = signal<Product[]>([]);
  prodFilterOptions = signal<ProductFilters>({ brands: [], types: [], seasons: [], units: [], part_categories: [], service_categories: [] });
  prodCurrentPage = signal(1);
  prodLastPage = signal(1);
  prodTotal = signal(0);
  prodPerPage = signal(20);
  prodSearchQuery = signal('');
  prodFilterType = signal('');
  prodFilterBrand = signal('');
  prodSortBy = signal('');
  prodSortDirection = signal<'asc' | 'desc'>('asc');
  prodLoading = signal(false);
  showProductForm = signal(false);
  editingProduct = signal<Product | null>(null);
  private prodResetting = false;

  constructor(
    private productService: ProductService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProductFilters();
    this.loadProductData();
  }

  loadProductData(): void {
    this.prodLoading.set(true);
    const filters = this.buildProductFilters();
    this.productService.getProducts(filters).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.prodCurrentPage.set(response.current_page);
        this.prodLastPage.set(response.last_page);
        this.prodTotal.set(response.total);
        this.prodLoading.set(false);
      },
      error: () => this.prodLoading.set(false),
    });
  }

  loadProductFilters(): void {
    this.productService.getFilters().subscribe({
      next: (filters) => this.prodFilterOptions.set(filters),
    });
  }

  private buildProductFilters(): Record<string, string> {
    const filters: Record<string, string> = {
      page: this.prodCurrentPage().toString(),
      per_page: this.prodPerPage().toString(),
      sort_by: this.prodSortBy(),
      sort_direction: this.prodSortDirection(),
    };
    if (this.prodSearchQuery()) filters['search'] = this.prodSearchQuery();
    if (this.prodFilterType()) filters['type'] = this.prodFilterType();
    if (this.prodFilterBrand()) filters['brand_id'] = this.prodFilterBrand();
    return filters;
  }

  prodSearch(): void {
    this.prodCurrentPage.set(1);
    this.prodSortBy.set('');
    this.prodSortDirection.set('asc');
    this.loadProductData();
  }

  prodApplyFilters(): void {
    if (this.prodResetting) return;
    this.prodCurrentPage.set(1);
    this.loadProductData();
  }

  prodToggleSort(column: string): void {
    if (this.prodSortBy() === column) {
      this.prodSortDirection.set(this.prodSortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.prodSortBy.set(column);
      this.prodSortDirection.set('asc');
    }
    this.prodCurrentPage.set(1);
    this.loadProductData();
  }

  prodResetFilters(): void {
    this.prodResetting = true;
    this.prodSearchQuery.set('');
    this.prodFilterType.set('');
    this.prodFilterBrand.set('');
    this.prodSortBy.set('');
    this.prodSortDirection.set('asc');
    this.prodCurrentPage.set(1);
    this.prodResetting = false;
    this.loadProductData();
  }

  prodGoToPage(page: number): void {
    if (page >= 1 && page <= this.prodLastPage()) {
      this.prodCurrentPage.set(page);
      this.loadProductData();
    }
  }

  openAddProductForm(): void {
    this.editingProduct.set(null);
    this.showProductForm.set(true);
  }

  openEditProductForm(product: Product): void {
    this.editingProduct.set(product);
    this.showProductForm.set(true);
  }

  closeProductForm(): void {
    this.showProductForm.set(false);
    this.editingProduct.set(null);
  }

  onProductFormSubmit(payload: ProductPayload): void {
    const editing = this.editingProduct();
    if (editing) {
      this.productService.updateProduct(editing.id, payload).subscribe({
        next: () => { this.closeProductForm(); this.loadProductData(); this.loadProductFilters(); },
      });
    } else {
      this.productService.createProduct(payload).subscribe({
        next: () => { this.closeProductForm(); this.loadProductData(); this.loadProductFilters(); },
      });
    }
  }

  toggleActive(product: Product): void {
    this.productService.toggleActive(product.id).subscribe({
      next: () => this.loadProductData(),
    });
  }

  deleteProduct(product: Product): void {
    const label = [product.brand?.name, product.profile, product.reference].filter(Boolean).join(' — ') || `Produit #${product.id}`;
    if (confirm(`Supprimer le produit "${label}" ?`)) {
      this.productService.deleteProduct(product.id).subscribe({
        next: () => { this.loadProductData(); this.loadProductFilters(); },
      });
    }
  }

  seasonLabel(season: string | null | undefined): string {
    switch (season) {
      case 'summer': return 'Été';
      case 'winter': return 'Hiver';
      case 'all_season': return '4 Saisons';
      default: return '-';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'tyre': return 'Pneu';
      case 'part': return 'Pièce';
      case 'service': return 'Service';
      default: return type;
    }
  }

  partCategoryLabel(category: string | null | undefined): string {
    switch (category) {
      case 'brakes': return 'Freinage';
      case 'lubricants': return 'Lubrifiants';
      case 'engine': return 'Moteur';
      case 'suspension': return 'Suspension';
      case 'filters': return 'Filtres';
      case 'electrical': return 'Électrique';
      case 'body': return 'Carrosserie';
      case 'other': return 'Autre';
      default: return category || '-';
    }
  }

  serviceCategoryLabel(category: string | null | undefined): string {
    switch (category) {
      case 'mechanical': return 'Mécanique';
      case 'oil': return 'Vidange';
      case 'tires': return 'Pneumatique';
      case 'bodywork': return 'Carrosserie';
      case 'diagnostic': return 'Diagnostic';
      case 'other': return 'Autre';
      default: return category || '-';
    }
  }

  get prodPages(): number[] {
    const total = this.prodLastPage();
    const current = this.prodCurrentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
