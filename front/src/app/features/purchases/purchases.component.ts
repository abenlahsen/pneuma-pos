import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../core/services/purchase.service';
import { Purchase, PurchaseSummary } from '../../core/models/purchase.model';
import { PurchaseFormComponent } from './purchase-form/purchase-form.component';
import { PurchasePaymentsComponent } from './purchase-payments/purchase-payments.component';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, PurchaseFormComponent, PurchasePaymentsComponent],
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.scss']
})
export class PurchasesComponent implements OnInit {
  private purchaseService = inject(PurchaseService);

  purchases = signal<Purchase[]>([]);
  summary = signal<PurchaseSummary | null>(null);
  filterOptions = signal<{ suppliers: { id: number; name: string }[]; commercials: { id: number; name: string }[] }>({ suppliers: [], commercials: [] });
  loading = signal<boolean>(false);

  currentPage = signal<number>(1);
  lastPage = signal<number>(1);
  total = signal<number>(0);
  perPage = signal<number>(100);

  filterSearch = signal('');
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterSupplier = signal('');
  filterCommercial = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  isFormOpen = signal<boolean>(false);
  selectedPurchase = signal<Purchase | null>(null);
  paymentPurchase = signal<Purchase | null>(null);

  get pages(): number[] {
    const pages = [];
    for (let i = 1; i <= this.lastPage(); i++) {
      pages.push(i);
    }
    return pages;
  }

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  private buildFilters(): Record<string, string> {
    return {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      search: this.filterSearch(),
      status: this.filterStatus(),
      payment_status: this.filterPaymentStatus(),
      supplier_id: this.filterSupplier(),
      commercial_id: this.filterCommercial(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.purchaseService.getPurchases(filters).subscribe({
      next: (response) => {
        this.purchases.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading purchases', err);
        this.loading.set(false);
      }
    });

    this.purchaseService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  loadFilters(): void {
    this.purchaseService.getFilters().subscribe({
      next: (filters) => this.filterOptions.set(filters),
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
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterSupplier.set('');
    this.filterCommercial.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
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

  openForm(purchase: Purchase | null = null): void {
    this.selectedPurchase.set(purchase);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.selectedPurchase.set(null);
  }

  onFormSaved(): void {
    this.closeForm();
    this.loadData();
    this.loadFilters();
  }

  openPayments(purchase: Purchase): void {
    this.paymentPurchase.set(purchase);
  }

  closePayments(): void {
    this.paymentPurchase.set(null);
    this.loadData();
  }

  updatePurchaseStatus(purchase: Purchase, target: any): void {
    const newStatus = target.value;
    if (purchase.status === newStatus) return;
    
    // Optimistic update
    const oldStatus = purchase.status;
    purchase.status = newStatus;
    
    const payload = {
      date: purchase.date,
      product: purchase.product,
      supplier_id: purchase.supplier_id,
      commercial_id: purchase.commercial_id,
      quantity: purchase.quantity,
      unit_price: purchase.unit_price,
      status: newStatus,
      payment_status: purchase.payment_status
    };

    this.purchaseService.updatePurchase(purchase.id, payload as any).subscribe({
      next: () => {
        // Updated confirmed
      },
      error: () => {
        // Revert on error
        purchase.status = oldStatus;
      }
    });
  }

  deletePurchase(purchase: Purchase): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'achat de ${purchase.product} ?`)) {
      this.purchaseService.deletePurchase(purchase.id).subscribe({
        next: () => this.loadData(),
        error: (err) => {
          console.error('Error deleting purchase', err);
          alert('Erreur lors de la suppression.');
        }
      });
    }
  }
}
