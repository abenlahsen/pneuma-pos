import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { Account, AccountPayload, TransferPayload } from '../../core/models/account.model';
import { AccountFormComponent } from './account-form/account-form.component';
import { TransferFormComponent } from './transfer-form/transfer-form.component';
import { CashFlowService } from '../../core/services/cash-flow.service';
import { Transaction, TransactionSummary } from '../../core/models/transaction.model';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, AccountFormComponent, TransferFormComponent],
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {
  accounts = signal<Account[]>([]);
  loading = signal(false);

  // Modals
  showAccountForm = signal(false);
  showTransferForm = signal(false);
  editingAccount = signal<Account | null>(null);

  // Detail View
  selectedAccount = signal<Account | null>(null);
  accountTransactions = signal<Transaction[]>([]);
  accountSummary = signal<TransactionSummary>({ income: 0, expenses: 0, balance: 0 });
  loadingTransactions = signal(false);

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
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        this.accounts.set(data);
        this.loading.set(false);
        if (this.selectedAccount()) {
          const updated = data.find(a => a.id === this.selectedAccount()?.id);
          if (updated) this.selectedAccount.set(updated);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  getIcon(type: string): string {
    switch (type) {
      case 'cash': return '💵';
      case 'bank': return '🏦';
      case 'person': return '👤';
      default: return '💼';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'cash': return 'Caisse';
      case 'bank': return 'Banque';
      case 'person': return 'Personne';
      default: return type;
    }
  }

  // Account Form
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

  // Transfer Form
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

  // Detail View
  viewAccount(account: Account) {
    this.selectedAccount.set(account);
    this.loadAccountTransactions(account);
  }

  backToOverview() {
    this.selectedAccount.set(null);
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
