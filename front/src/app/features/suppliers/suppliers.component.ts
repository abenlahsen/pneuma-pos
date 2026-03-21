import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupplierService } from '../../core/services/supplier.service';
import { AuthService } from '../../core/services/auth.service';
import { Supplier, SupplierPayload, PaginatedResponse } from '../../core/models/supplier.model';
import { SupplierFormComponent } from './supplier-form/supplier-form.component';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SupplierFormComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.scss',
})
export class SuppliersComponent implements OnInit {
  suppliers = signal<Supplier[]>([]);
  
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);
  
  filterSearch = signal('');
  
  loading = signal(false);
  showForm = signal(false);
  editingSupplier = signal<Supplier | null>(null);

  constructor(
    private supplierService: SupplierService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filters = {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch()
    };

    this.supplierService.getSuppliers(filters).subscribe({
      next: (response) => {
        const paginated = response as PaginatedResponse<Supplier>;
        this.suppliers.set(paginated.data);
        this.currentPage.set(paginated.current_page);
        this.lastPage.set(paginated.last_page);
        this.total.set(paginated.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterSearch.set('');
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
