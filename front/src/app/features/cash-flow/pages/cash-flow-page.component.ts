import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionFormComponent } from '../components/transaction-form/transaction-form.component';
import { TransferFormComponent } from '../../accounts/transfer-form/transfer-form.component';
import { CashFlowService } from '../data-access/cash-flow.service';
import {
  CashFlowProjection,
  PaginatedResponse,
  Transaction,
  TransactionFilters,
  TransactionPayload,
  TransactionSummary,
} from '../models/transaction.model';
import { TransferPayload } from '../../accounts/models/account.model';
import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonRowComponent,
  describeLoadError,
  frenchDate,
} from '../../../shared/list-state';

/** Une ligne du registre unique : échéance à venir, marqueur « aujourd'hui », ou mouvement passé. */
export interface RegisterRow {
  kind: 'pending' | 'today' | 'settled';
  transaction?: Transaction;
  /** Solde progressif à cette date. null quand il n'est pas calculable (pages suivantes). */
  balance: number | null;
}
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { AccountService } from '../../accounts/data-access/account.service';
import { Account } from '../../accounts/models/account.model';
import { PurchasePaymentDetailComponent } from '../../purchases/components/purchase-payment-detail/purchase-payment-detail.component';
import { SalePaymentDetailComponent } from '../../sales/components/sale-payment-detail/sale-payment-detail.component';
import { TransactionCategoryService } from '../../transaction-categories/data-access/transaction-category.service';
import { TransactionCategory } from '../../transaction-categories/models/transaction-category.model';

@Component({
  selector: 'app-cash-flow-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TransactionFormComponent, TransferFormComponent, AutoRefreshControlComponent, PurchasePaymentDetailComponent, SalePaymentDetailComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent],
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
  filterSubcategory = signal('');
  filterAccount = signal('');
  filterPerson = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterSearch = signal('');
  filterPartner = signal('');
  filterAmountMin = signal('');

  filterAmountMax = signal('');

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Refonte 2b : tant que le résumé n'est pas revenu, les cadrans affichent
   * « — » et non 0. Un 0 affirme un chiffre — « CA du jour : 0,00 DH » — que
   * l'on n'a pas encore, et qui restait affiché si la requête échouait.
   */
  readonly summaryLoaded = signal(false);

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

    if (this.filterSearch()) drop(`recherche « ${this.filterSearch()} »`, () => this.filterSearch.set(''));
    if (this.filterType()) drop(this.filterType() === 'income' ? 'entrées' : 'sorties', () => this.filterType.set(''));
    if (this.filterCategory()) drop(`catégorie ${this.filterCategory()}`, () => this.filterCategory.set(''));
    if (this.filterSubcategory()) drop(`sous-catégorie ${this.filterSubcategory()}`, () => this.filterSubcategory.set(''));
    if (this.filterAccount()) {
      const account = this.filterOptions().accounts.find((a) => String(a.id) === this.filterAccount());
      drop(`compte ${account?.name ?? this.filterAccount()}`, () => this.filterAccount.set(''));
    }
    if (this.filterPerson()) drop(`personne ${this.filterPerson()}`, () => this.filterPerson.set(''));
    if (this.filterPartner()) {
      const partner = this.filterOptions().partners.find((p) => String(p.id) === this.filterPartner());
      drop(`partenaire ${partner?.name ?? this.filterPartner()}`, () => this.filterPartner.set(''));
    }
    if (this.filterDateFrom()) drop(`à partir du ${frenchDate(this.filterDateFrom())}`, () => this.filterDateFrom.set(''));
    if (this.filterDateTo()) drop(`jusqu'au ${frenchDate(this.filterDateTo())}`, () => this.filterDateTo.set(''));
    if (this.filterAmountMin()) drop(`montant ≥ ${this.filterAmountMin()}`, () => this.filterAmountMin.set(''));
    if (this.filterAmountMax()) drop(`montant ≤ ${this.filterAmountMax()}`, () => this.filterAmountMax.set(''));

    return applied;
  });

  /** Date du jour, pour le marqueur « Aujourd'hui » du registre. */
  readonly today = new Date();

  pendingTransactions = signal<Transaction[]>([]);
  loadingPending = signal(false);
  pendingCollapsed = signal(false);

  loading = signal(false);
  deletingTransactionId = signal<number | null>(null);
  showForm = signal(false);
  editingTransaction = signal<Transaction | null>(null);
  accounts = signal<Account[]>([]);

  incomeCategoryTree = signal<TransactionCategory[]>([]);
  expenseCategoryTree = signal<TransactionCategory[]>([]);

  // ── Refonte 2b : projection, registre unique, volet droit ──────────────────
  readonly projection = signal<CashFlowProjection | null>(null);
  readonly loadingProjection = signal(false);
  readonly filtersExpanded = signal(false);
  readonly registerTab = signal<'tout' | 'a_venir' | 'entrees' | 'sorties'>('tout');
  readonly showTransferForm = signal(false);

  /** Trésorerie réelle du jour : somme des soldes courants des comptes actifs. */
  readonly todayBalance = computed(() =>
    this.projection()?.today_balance
      ?? this.accounts().reduce((sum, a) => sum + Number(a.current_balance || 0), 0)
  );

  /** Chèques/effets émis ou reçus mais pas encore encaissés (solde attendu − solde courant). */
  readonly pendingNet = computed(() =>
    this.accounts().reduce(
      (sum, a) => sum + (Number(a.expected_balance || 0) - Number(a.current_balance || 0)),
      0,
    )
  );

  readonly availableBalance = computed(() =>
    this.accounts().reduce((sum, a) => sum + Number(a.expected_balance || 0), 0)
  );

  /** Échelle des barres : la plus haute semaine fait 100 %. */
  readonly maxWeekBalance = computed(() => {
    const weeks = this.projection()?.weeks ?? [];
    return Math.max(1, ...weeks.map((w) => Math.abs(w.balance)));
  });

  readonly maxExpenseCategory = computed(() => {
    const rows = this.projection()?.expenses_by_category ?? [];
    return Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  });

  /**
   * Un solde progressif n'a de sens que sur le flux complet des mouvements :
   * dès qu'un filtre retire des lignes (ou qu'on quitte la première page, dont
   * le point d'ancrage est la trésorerie réelle du jour), la colonne afficherait
   * une somme partielle qui ressemble à un solde sans en être un. Dans ces cas
   * elle reste vide.
   */
  readonly balanceColumnAvailable = computed(() =>
    this.currentPage() === 1
    && !this.filterType()
    && !this.filterAccount()
    && !this.filterCategory()
    && !this.filterSubcategory()
    && !this.filterPerson()
    && !this.filterPartner()
    && !this.filterSearch()
    && !this.filterDateFrom()
    && !this.filterDateTo()
    && !this.filterAmountMin()
    && !this.filterAmountMax()
  );

  /**
   * Registre unique : échéances à venir (ascendant) → marqueur « aujourd'hui »
   * → mouvements passés (descendant), avec le solde progressif en colonne.
   */
  readonly registerRows = computed<RegisterRow[]>(() => {
    const rows: RegisterRow[] = [];
    const anchor = this.todayBalance();
    const withBalance = this.balanceColumnAvailable();

    let running = anchor;
    const pending = [...this.pendingTransactions()].sort((a, b) => a.date.localeCompare(b.date));
    for (const t of pending) {
      running = this.round2(running + this.signedAmount(t));
      rows.push({ kind: 'pending', transaction: t, balance: withBalance ? running : null });
    }

    if (this.registerTab() === 'a_venir') {
      return rows;
    }

    rows.push({ kind: 'today', balance: anchor });

    running = anchor;
    for (const t of this.transactions()) {
      rows.push({ kind: 'settled', transaction: t, balance: withBalance ? running : null });
      running = this.round2(running - this.signedAmount(t));
    }

    return rows;
  });

  private signedAmount(t: Transaction): number {
    return t.type === 'income' ? Number(t.amount) : -Number(t.amount);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  filterCategoryOptions = computed<TransactionCategory[]>(() => {
    if (this.filterType() === 'income') return this.incomeCategoryTree();
    if (this.filterType() === 'expense') return this.expenseCategoryTree();
    return [...this.incomeCategoryTree(), ...this.expenseCategoryTree()];
  });

  filterSubcategoryOptions = computed<TransactionCategory[]>(() => {
    const category = this.filterCategoryOptions().find((c) => c.name === this.filterCategory());
    return category?.children || [];
  });

  constructor(
    private cashFlowService: CashFlowService,
    private accountService: AccountService,
    private transactionCategoryService: TransactionCategoryService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
    this.loadFilters();
    this.loadCategoryTrees();
    this.loadData();
    this.loadProjection();
  }

  loadProjection(): void {
    this.loadingProjection.set(true);
    this.cashFlowService.getProjection().subscribe({
      next: (projection) => {
        this.projection.set(projection);
        this.loadingProjection.set(false);
      },
      error: () => this.loadingProjection.set(false),
    });
  }

  /** Onglets rapides du registre. Entrées/Sorties passent par le filtre type existant. */
  selectRegisterTab(tab: 'tout' | 'a_venir' | 'entrees' | 'sorties'): void {
    this.registerTab.set(tab);

    const nextType = tab === 'entrees' ? 'income' : tab === 'sorties' ? 'expense' : '';
    if (this.filterType() !== nextType) {
      this.filterType.set(nextType);
      this.filterCategory.set('');
      this.filterSubcategory.set('');
      this.applyFilters();
    }
  }

  openTransferForm(): void {
    this.showTransferForm.set(true);
  }

  closeTransferForm(): void {
    this.showTransferForm.set(false);
  }

  onTransferSubmit(payload: TransferPayload): void {
    this.accountService.transfer(payload).subscribe({
      next: () => {
        this.closeTransferForm();
        this.loadAccounts();
        this.loadData();
        this.loadProjection();
      },
      error: (err) => alert(err?.error?.message || 'Le transfert a échoué.'),
    });
  }

  loadCategoryTrees(): void {
    this.transactionCategoryService.getTree('income', true).subscribe({
      next: (categories) => this.incomeCategoryTree.set(categories),
      error: () => this.incomeCategoryTree.set([]),
    });
    this.transactionCategoryService.getTree('expense', true).subscribe({
      next: (categories) => this.expenseCategoryTree.set(categories),
      error: () => this.expenseCategoryTree.set([]),
    });
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

    this.cashFlowService.getTransactions({ ...filters, status: 'pending', page: '1', per_page: '500' }).subscribe({
      next: (response) => {
        this.pendingTransactions.set((response as PaginatedResponse<Transaction>).data);
        this.loadingPending.set(false);
      },
      error: () => this.loadingPending.set(false),
    });

    this.cashFlowService.getSummary(filters).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.summaryLoaded.set(true);
      },
      error: () => this.summaryLoaded.set(false),
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
      subcategory: this.filterSubcategory(),
      person: this.filterPerson(),
      date_from: this.filterDateFrom(),
      date_to: this.filterDateTo(),
      search: this.filterSearch(),
      partner_id: this.filterPartner(),
      amount_min: this.filterAmountMin(),
      amount_max: this.filterAmountMax(),
    };
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterType.set('');
    this.filterAccount.set('');
    this.filterCategory.set('');
    this.filterSubcategory.set('');
    this.filterPerson.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterSearch.set('');
    this.filterPartner.set('');
    this.filterAmountMin.set('');
    this.filterAmountMax.set('');
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
          this.loadAccounts();
          this.loadProjection();
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
          this.loadAccounts();
          this.loadProjection();
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
        this.loadAccounts();
        this.loadProjection();
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
