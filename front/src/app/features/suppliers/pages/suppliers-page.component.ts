import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupplierService } from '../data-access/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import { Supplier, SupplierPayload, PaginatedResponse, SupplierUnpaidRow } from '../models/supplier.model';
import { SupplierFormComponent } from '../components/supplier-form/supplier-form.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SupplierFormComponent, AutoRefreshControlComponent],
  templateUrl: './suppliers-page.component.html',
  styleUrls: ['./suppliers-page.component.scss'],
})
export class SuppliersPageComponent implements OnInit {
  suppliers = signal<Supplier[]>([]);

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);

  filterSearch = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  loading = signal(false);
  showForm = signal(false);
  editingSupplier = signal<Supplier | null>(null);

  unpaidBySupplier = signal<SupplierUnpaidRow[]>([]);
  loadingUnpaid = signal(false);

  unpaidTotals = computed(() =>
    this.unpaidBySupplier().reduce(
      (acc, row) => ({
        total_unpaid: acc.total_unpaid + row.total_unpaid,
        unpaid_with_invoice: acc.unpaid_with_invoice + row.unpaid_with_invoice,
        unpaid_without_invoice: acc.unpaid_without_invoice + row.unpaid_without_invoice,
      }),
      { total_unpaid: 0, unpaid_with_invoice: 0, unpaid_without_invoice: 0 },
    )
  );

  constructor(
    private supplierService: SupplierService,
    public authService: AuthService,
    private router: Router,
  ) {}

  viewSupplier(supplier: Supplier): void {
    this.router.navigate(['/suppliers', supplier.id]);
  }

  viewSupplierById(id: number | null): void {
    if (id) {
      this.router.navigate(['/suppliers', id]);
    }
  }

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.loadData();
    this.loadUnpaidSummary();
  }

  loadUnpaidSummary(): void {
    this.loadingUnpaid.set(true);
    this.supplierService.getUnpaidSummary().subscribe({
      next: (summary) => {
        this.unpaidBySupplier.set(summary.rows);
        this.loadingUnpaid.set(false);
      },
      error: () => this.loadingUnpaid.set(false),
    });
  }

  loadData(): void {
    this.loading.set(true);
    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 100) || 100;

    const filters = {
      page: page.toString(),
      per_page: perPage.toString(),
      search: this.filterSearch(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };

    this.supplierService.getSuppliers(filters).subscribe({
      next: (response) => {
        const paginated = response as PaginatedResponse<Supplier>;
        this.suppliers.set(paginated.data);
        this.currentPage.set(Number(paginated.current_page ?? 1) || 1);
        this.lastPage.set(Number(paginated.last_page ?? 1) || 1);
        this.total.set(Number(paginated.total ?? 0) || 0);
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
    this.editingSupplier.set(null);
    this.showForm.set(true);
  }

  openEditForm(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingSupplier.set(null);
  }

  onFormSubmit(payload: SupplierPayload): void {
    const editing = this.editingSupplier();
    if (editing) {
      this.supplierService.updateSupplier(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    } else {
      this.supplierService.createSupplier(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
        },
      });
    }
  }

  deleteSupplier(supplier: Supplier): void {
    if (confirm(`Voulez-vous vraiment supprimer le fournisseur "${supplier.name}" ?`)) {
      this.supplierService.deleteSupplier(supplier.id).subscribe({
        next: () => this.loadData(),
      });
    }
  }

  logout(): void {
    this.authService.logout();
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
