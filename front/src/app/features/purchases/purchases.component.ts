import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../core/services/purchase.service';
import { Purchase, PurchaseSummary } from '../../core/models/purchase.model';
import { PurchaseFormComponent } from './purchase-form/purchase-form.component';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, PurchaseFormComponent],
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.scss']
})
export class PurchasesComponent implements OnInit {
  private purchaseService = inject(PurchaseService);

  purchases = signal<Purchase[]>([]);
  summary = signal<PurchaseSummary | null>(null);
  loading = signal<boolean>(false);
  
  currentPage = signal<number>(1);
  lastPage = signal<number>(1);
  total = signal<number>(0);
  perPage = signal<number>(10);
  
  filterSearch = signal<string>('');
  filterStatus = signal<string>('');

  isFormOpen = signal<boolean>(false);
  selectedPurchase = signal<Purchase | null>(null);

  get pages(): number[] {
    const pages = [];
    for (let i = 1; i <= this.lastPage(); i++) {
      pages.push(i);
    }
    return pages;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(page: number = 1): void {
    this.loading.set(true);
    this.purchaseService.getPurchases(page, this.filterSearch(), this.filterStatus())
      .subscribe({
        next: (response) => {
          this.purchases.set(response.data);
          this.currentPage.set(response.current_page);
          this.lastPage.set(response.last_page);
          this.total.set(response.total);
          this.loading.set(false);
          this.loadSummary();
        },
        error: (err) => {
          console.error('Error loading purchases', err);
          this.loading.set(false);
        }
      });
  }

  loadSummary(): void {
    this.purchaseService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
      error: (err) => console.error('Error loading summary', err)
    });
  }

  applyFilters(): void {
    this.loadData(1);
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterStatus.set('');
    this.loadData(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.loadData(page);
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
    this.loadData(this.currentPage());
  }

  updatePurchaseStatus(purchase: Purchase, target: any): void {
    const newStatus = target.value;
    if (purchase.status === newStatus) return;
    
    // Optimistic update
    const oldStatus = purchase.status;
    purchase.status = newStatus;
    
    this.purchaseService.updatePurchase(purchase.id, { status: newStatus } as any).subscribe({
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
        next: () => this.loadData(this.currentPage()),
        error: (err) => {
          console.error('Error deleting purchase', err);
          alert('Erreur lors de la suppression.');
        }
      });
    }
  }
}
