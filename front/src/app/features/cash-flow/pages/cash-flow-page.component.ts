import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionFormComponent } from '../components/transaction-form/transaction-form.component';
import { CashFlowService } from '../data-access/cash-flow.service';
import {
  PaginatedResponse,
  Transaction,
  TransactionFilters,
  TransactionPayload,
  TransactionSummary,
} from '../models/transaction.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { AccountService } from '../../accounts/data-access/account.service';
import { Account } from '../../accounts/models/account.model';
import { PurchasePaymentDetailComponent } from '../../purchases/components/purchase-payment-detail/purchase-payment-detail.component';
import { SalePaymentDetailComponent } from '../../sales/components/sale-payment-detail/sale-payment-detail.component';

@Component({
  selector: 'app-cash-flow-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TransactionFormComponent, AutoRefreshControlComponent, PurchasePaymentDetailComponent, SalePaymentDetailComponent],
  templateUrl: './cash-flow-page.component.html',
  styleUrls: ['./cash-flow-page.component.scss'],
})
export class CashFlowPageComponent implements OnInit {
  viewingPaymentId = signal<number | null>(null);
  viewingSalePaymentId = signal<number | null>(null);
  transactions = signal<Transaction[]>([]);
  summary = signal<TransactionSummary>({ income: 0, expenses: 0, balance: 0, pending_income: 0, pending_expense: 0 });
  filterOptions = signal<TransactionFilters>({ categories: [], persons: [], partners: [], accounts: [] });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);

  filterType = signal('');
  filterCategory = signal('');
  filterAccount = signal('');
  filterPerson = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterSearch = signal('');
  filterPartner = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  pendingTransactions = signal<Transaction[]>([]);
  loadingPending = signal(false);
  pendingCollapsed = signal(false);

  loading = signal(false);
  deletingTransactionId = signal<number | null>(null);
  showForm = signal(false);
  editingTransaction = signal<Transaction | null>(null);
  accounts = signal<Account[]>([]);

  constructor(
    private cashFlowService: CashFlowService,
    private accountService: AccountService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
    this.loadFilters();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.loadingPending.set(true);
    const filters = this.buildFilters();

    this.cashFlowService.getTransactions({ ...filters, status: 'settled' }).subscribe({
      next: (response) => {
        this.transactions.set((response as PaginatedResponse<Transaction>).data);
        this.currentPage.set(response.current_page);
        this.lastPage.set(response.last_page);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.cashFlowService.getTransactions({ ...filters, status: 'pending', page: '1', per_page: '500' }).subscribe({
      next: (response) => {
        this.pendingTransactions.set((response as PaginatedResponse<Transaction>).data);
        this.loadingPending.set(false);
      },
      error: () => this.loadingPending.set(false),
    });

    this.cashFlowService.getSummary(filters).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  loadAccounts(): void {
    this.accountService.getAccounts({ all: '1', is_active: '1' }).subscribe({
      next: (res: any) => this.accounts.set(Array.isArray(res) ? res : res.data),
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
      account_id: this.filterAccount(),
      category: this.filterCategory(),
      person: this.filterPerson(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      search: this.filterSearch(),
      partner_id: this.filterPartner(),
      amount_min: this.filterAmountMin(),
      amount_max: this.filterAmountMax(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };
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
    this.filterType.set('');
    this.filterAccount.set('');
    this.filterCategory.set('');
    this.filterPerson.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterSearch.set('');
    this.filterPartner.set('');
    this.filterAmountMin.set('');
    this.filterAmountMax.set('');
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
    this.editingTransaction.set(null);
    this.showForm.set(true);
  }

  openEditForm(transaction: Transaction): void {
    this.editingTransaction.set(transaction);
    this.showForm.set(true);
  }

  openPaymentView(transaction: Transaction): void {
    if (transaction.purchase_payment_id) this.viewingPaymentId.set(transaction.purchase_payment_id);
  }

  closePaymentView(): void {
    this.viewingPaymentId.set(null);
  }

  openSalePaymentView(transaction: Transaction): void {
    if (transaction.sale_payment_id) this.viewingSalePaymentId.set(transaction.sale_payment_id);
  }

  closeSalePaymentView(): void {
    this.viewingSalePaymentId.set(null);
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
        error: (err) => {
          const msg = err?.error?.message || 'Erreur lors de la modification.';
          alert(msg);
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
    if (!confirm(`Supprimer cette transaction ?\n"${transaction.description}"`)) {
      return;
    }

    this.deletingTransactionId.set(transaction.id);

    this.cashFlowService.deleteTransaction(transaction.id).subscribe({
      next: () => {
        this.deletingTransactionId.set(null);
        this.loadData();
        this.loadFilters();
      },
      error: (err) => {
        this.deletingTransactionId.set(null);
        const msg = err?.error?.message || 'Erreur lors de la suppression.';
        alert(msg);
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
