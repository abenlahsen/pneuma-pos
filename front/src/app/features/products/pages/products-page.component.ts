import { computed, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../data-access/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, ProductFilters, ProductPayload } from '../models/product.model';
import { ProductFormComponent } from '../product-form/product-form.component';
import { ProductDetailComponent } from '../product-detail/product-detail.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { SortIconComponent } from '../../../shared/icon/sort-icon.component';

import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  RowLockComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent, ProductDetailComponent, AutoRefreshControlComponent, SortIconComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, RowLockComponent],
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

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /** Dimension du pneu, ou catégorie pour une pièce ou une prestation. */
  dimensionFor(product: Product): string {
    if (product.type === 'tyre') {
      const tyre = product.tyre;
      return tyre?.tire_width ? `${tyre.tire_width}/${tyre.tire_height}R${tyre.tire_diameter}` : '—';
    }
    if (product.type === 'part') return this.partCategoryLabel(product.part?.category) || '—';

    return this.serviceCategoryLabel(product.service?.category) || '—';
  }

  /** Marque et profil font le nom : c'est ainsi qu'on désigne un pneu à l'oral. */
  nameFor(product: Product): string {
    return [product.brand?.name, product.profile].filter(Boolean).join(' ') || product.reference || 'Sans nom';
  }

  /**
   * Règle 3 du motif de ligne. Indice de charge, indice de vitesse, saison,
   * run-flat, renforcé et marquage tenaient six colonnes à eux seuls, pour
   * qualifier un objet que personne ne trie sur ces critères.
   */
  subLineFor(product: Product): string {
    const parts: string[] = [];

    if (product.type === 'tyre') {
      const tyre = product.tyre;
      const indices = `${tyre?.tire_load_index ?? ''}${tyre?.tire_speed_index ?? ''}`.trim();
      if (indices) parts.push(indices);
      if (tyre?.tire_season) parts.push(this.seasonLabel(tyre.tire_season));
      if (tyre?.tire_runflat) parts.push('RFT');
      if (tyre?.tire_reinforced) parts.push('XL');
      if (tyre?.tire_marking) parts.push(tyre.tire_marking);
    } else if (product.type === 'part' && product.part?.oem_reference) {
      parts.push(product.part.oem_reference);
    } else if (product.type === 'service' && product.service?.duration_minutes) {
      parts.push(`${product.service.duration_minutes} min`);
    }

    if (product.description) parts.push(product.description);

    return parts.join(' · ') || '—';
  }

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
    if (this.filterType()) drop(`type ${this.filterType()}`, () => this.filterType.set(''));
    if (this.filterBrand()) drop(`marque ${this.filterBrand()}`, () => this.filterBrand.set(''));
    if (this.filterProfile()) drop(`profil ${this.filterProfile()}`, () => this.filterProfile.set(''));

    return applied;
  });
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