import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandService } from '../data-access/brand.service';
import { AuthService } from '../../../core/services/auth.service';
import { Brand, BrandPayload } from '../models/brand.model';
import { BrandFormComponent } from '../components/brand-form/brand-form.component';

@Component({
  selector: 'app-brands-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BrandFormComponent],
  templateUrl: './brands-page.component.html',
  styleUrls: ['./brands-page.component.scss'],
})
export class BrandsPageComponent implements OnInit {
  brands = signal<Brand[]>([]);

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  filterSearch = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  loading = signal(false);
  deletingBrandId = signal<number | null>(null);
  showForm = signal(false);
  editingBrand = signal<Brand | null>(null);

  constructor(
    private brandService: BrandService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 20) || 20;

    const filters: Record<string, string> = {
      page: page.toString(),
      per_page: perPage.toString(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };

    if (this.filterSearch()) {
      filters['search'] = this.filterSearch();
    }

    this.brandService.getBrands(filters).subscribe({
      next: (response) => {
        this.brands.set(response.data);
        this.currentPage.set(Number(response.current_page ?? 1) || 1);
        this.lastPage.set(Number(response.last_page ?? 1) || 1);
        this.total.set(Number(response.total ?? 0) || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

  openAddForm(): void {
    this.editingBrand.set(null);
    this.showForm.set(true);
  }

  openEditForm(brand: Brand): void {
    this.editingBrand.set(brand);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingBrand.set(null);
  }

  onFormSubmit(event: { payload: BrandPayload; logo?: File }): void {
    const editing = this.editingBrand();
    if (editing) {
      this.brandService.updateBrand(editing.id, event.payload, event.logo).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    } else {
      this.brandService.createBrand(event.payload, event.logo).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    }
  }

  toggleActive(brand: Brand): void {
    this.brandService.toggleActive(brand.id).subscribe({
      next: () => this.loadData(),
    });
  }

  deleteBrand(brand: Brand): void {
    if (!confirm(`Supprimer la marque "${brand.name}" ?`)) {
      return;
    }

    this.deletingBrandId.set(brand.id);

    this.brandService.deleteBrand(brand.id).subscribe({
      next: () => {
        this.deletingBrandId.set(null);
        this.loadData();
      },
      error: () => {
        this.deletingBrandId.set(null);
      },
    });
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
