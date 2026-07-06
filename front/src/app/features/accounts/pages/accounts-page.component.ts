import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../data-access/account.service';
import { AuthService } from '../../../core/services/auth.service';
import { Account, AccountPayload, TransferPayload } from '../models/account.model';
import { AccountFormComponent } from '../account-form/account-form.component';
import { TransferFormComponent } from '../transfer-form/transfer-form.component';
import { CashFlowService } from '../../../core/services/cash-flow.service';
import { Transaction, TransactionSummary } from '../../../core/models/transaction.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { PurchasePaymentDetailComponent } from '../../purchases/components/purchase-payment-detail/purchase-payment-detail.component';
import { SalePaymentDetailComponent } from '../../sales/components/sale-payment-detail/sale-payment-detail.component';

@Component({
  selector: 'app-accounts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AccountFormComponent, TransferFormComponent, AutoRefreshControlComponent, PurchasePaymentDetailComponent, SalePaymentDetailComponent],
  templateUrl: './accounts-page.component.html',
  styleUrls: ['./accounts-page.component.scss']
})
export class AccountsPageComponent implements OnInit {
  viewingPaymentId = signal<number | null>(null);
  viewingSalePaymentId = signal<number | null>(null);
  accounts = signal<Account[]>([]);
  loading = signal(false);

  showAccountForm = signal(false);
  showTransferForm = signal(false);
  editingAccount = signal<Account | null>(null);

  selectedAccount = signal<Account | null>(null);
  accountTransactions = signal<Transaction[]>([]);
  accountSummary = signal<TransactionSummary>({ income: 0, expenses: 0, balance: 0, pending_income: 0, pending_expense: 0 });
  loadingTransactions = signal(false);

  pendingTransactions = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.accountTransactions().filter(t =>
      (t.method === 'Chèque' || t.method === 'Effet') && t.date > today
    );
  });

  settledTransactions = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.accountTransactions().filter(t =>
      !((t.method === 'Chèque' || t.method === 'Effet') && t.date > today)
    );
  });

  constructor(
    private accountService: AccountService,
    private cashFlowService: CashFlowService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.loading.set(true);
    this.accountService.getAccounts({ all: '1' }).subscribe({
      next: (response) => {
        const accounts = Array.isArray(response) ? response : (response.data ?? []);
        this.accounts.set(accounts);
        this.loading.set(false);
        if (this.selectedAccount()) {
          const updated = accounts.find((a: Account) => a.id === this.selectedAccount()?.id);
          if (updated) {
            this.selectedAccount.set(updated);
          }
        }
      },
      error: () => this.loading.set(false)
    });
  }

  getIcon(type: string): string {
    switch (type) {
      case 'cash':
        return '💵';
      case 'bank':
        return '🏦';
      case 'person':
        return '👤';
      default:
        return '💼';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'cash':
        return 'Caisse';
      case 'bank':
        return 'Banque';
      case 'person':
        return 'Personne';
      default:
        return type;
    }
  }

  openAddForm() {
    this.editingAccount.set(null);
    this.showAccountForm.set(true);
  }

  openEditForm(account: Account, event: Event) {
    event.stopPropagation();
    this.editingAccount.set(account);
    this.showAccountForm.set(true);
  }

  onAccountSubmit(payload: AccountPayload) {
    const edit = this.editingAccount();
    if (edit) {
      this.accountService.updateAccount(edit.id, payload).subscribe(() => {
        this.showAccountForm.set(false);
        this.loadAccounts();
      });
    } else {
      this.accountService.createAccount(payload).subscribe(() => {
        this.showAccountForm.set(false);
        this.loadAccounts();
      });
    }
  }

  deleteAccount(account: Account, event: Event) {
    event.stopPropagation();
    if (confirm(`Supprimer le compte ${account.name} ?`)) {
      this.accountService.deleteAccount(account.id).subscribe(() => {
        if (this.selectedAccount()?.id === account.id) {
          this.selectedAccount.set(null);
        }
        this.loadAccounts();
      });
    }
  }

  openTransferForm() {
    this.showTransferForm.set(true);
  }

  onTransferSubmit(payload: TransferPayload) {
    this.accountService.transfer(payload).subscribe(() => {
      this.showTransferForm.set(false);
      this.loadAccounts();
      if (this.selectedAccount()) {
        this.loadAccountTransactions(this.selectedAccount()!);
      }
    });
  }

  viewAccount(account: Account) {
    this.selectedAccount.set(account);
    this.loadAccountTransactions(account);
  }

  backToOverview() {
    this.selectedAccount.set(null);
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

  loadAccountTransactions(account: Account) {
    this.loadingTransactions.set(true);
    const filter = { account_id: account.id.toString(), per_page: '100' };

    this.cashFlowService.getTransactions(filter).subscribe({
      next: (res) => {
        this.accountTransactions.set(res.data);
        this.loadingTransactions.set(false);
      },
      error: () => this.loadingTransactions.set(false)
    });

    this.cashFlowService.getSummary(filter).subscribe(summary => {
      this.accountSummary.set(summary);
    });
  }
}
