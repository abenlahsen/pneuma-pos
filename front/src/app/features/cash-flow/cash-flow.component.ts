import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CashFlowService } from '../../core/services/cash-flow.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Transaction,
  TransactionPayload,
  TransactionSummary,
  TransactionFilters,
  PaginatedResponse,
} from '../../core/models/transaction.model';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';

@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TransactionFormComponent],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.scss',
})
export class CashFlowComponent implements OnInit {
  // Data
  transactions = signal<Transaction[]>([]);
  summary = signal<TransactionSummary>({ income: 0, expenses: 0, balance: 0 });
  filterOptions = signal<TransactionFilters>({ categories: [], persons: [], partners: [] });

  // Pagination
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  // Filters
  filterType = signal('');
  filterCategory = signal('');
  filterPerson = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterSearch = signal('');

  // UI state
  loading = signal(false);
  showForm = signal(false);
  editingTransaction = signal<Transaction | null>(null);

  constructor(
    private cashFlowService: CashFlowService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filters = this.buildFilters();

    this.cashFlowService.getTransactions(filters).subscribe({
      next: (response) => {
        this.transactions.set(response.data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.cashFlowService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  loadFilters(): void {
    this.cashFlowService.getFilters().subscribe({
      next: (filters) => this.filterOptions.set(filters),
    });
  }

  private buildFilters(): Record<string, string> {
    return {
      page: this.currentPage().toString(),
      per_page: this.perPage().toString(),
      type: this.filterType(),
      category: this.filterCategory(),
      person: this.filterPerson(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      search: this.filterSearch(),
    };
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterType.set('');
    this.filterCategory.set('');
    this.filterPerson.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
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
    this.editingTransaction.set(null);
    this.showForm.set(true);
  }

  openEditForm(transaction: Transaction): void {
    this.editingTransaction.set(transaction);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingTransaction.set(null);
  }

  onFormSubmit(payload: TransactionPayload): void {
    const editing = this.editingTransaction();

    if (editing) {
      this.cashFlowService.updateTransaction(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    } else {
      this.cashFlowService.createTransaction(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadFilters();
        },
      });
    }
  }

  deleteTransaction(transaction: Transaction): void {
    if (confirm(`Supprimer cette transaction ?\n"${transaction.description}"`)) {
      this.cashFlowService.deleteTransaction(transaction.id).subscribe({
        next: () => {
          this.loadData();
          this.loadFilters();
        },
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
