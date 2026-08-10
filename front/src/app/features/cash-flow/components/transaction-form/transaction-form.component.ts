import { Component, EventEmitter, Input, OnChanges, OnInit, Output, computed, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account } from '../../../accounts/models/account.model';
import { Transaction, TransactionFilters, TransactionPayload } from '../../models/transaction.model';
import { TransactionCategory, TransactionCategoryType } from '../../../transaction-categories/models/transaction-category.model';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss',
})
export class TransactionFormComponent implements OnInit, OnChanges {
  @Input() transaction: Transaction | null = null;
  @Input() filterOptions: TransactionFilters = { categories: [], persons: [], partners: [], accounts: [] };
  @Input() accounts: Account[] = [];
  @Input() incomeCategories: TransactionCategory[] = [];
  @Input() expenseCategories: TransactionCategory[] = [];
  @Output() submitted = new EventEmitter<TransactionPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  isEdit = signal(false);

  // Both trees are already loaded once by the parent page (CashFlowPageComponent)
  // and passed in as @Input() — no HTTP call is made here, so the category
  // dropdown is populated instantly on open and on type toggle.
  private incomeCategoriesSig = signal<TransactionCategory[]>([]);
  private expenseCategoriesSig = signal<TransactionCategory[]>([]);
  selectedType = signal<TransactionCategoryType>('expense');

  categoryTree = computed(() =>
    this.selectedType() === 'income' ? this.incomeCategoriesSig() : this.expenseCategoriesSig(),
  );
  selectedCategoryName = signal('');
  selectedCategoryChildren = computed(() => {
    const found = this.categoryTree().find((c) => c.name === this.selectedCategoryName());
    return found?.children || [];
  });

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.isEdit.set(!!this.transaction);
    // ngOnChanges already ran with the initial @Input() values (Angular calls it
    // before ngOnInit whenever bound inputs are present), so incomeCategoriesSig /
    // expenseCategoriesSig are already populated here.
    this.selectedType.set(this.transaction?.type || 'expense');

    this.form = this.fb.group({
      date: [this.transaction?.date || this.todayDate(), [Validators.required]],
      amount: [this.transaction?.amount || null, [Validators.required, Validators.min(0.01)]],
      account_id: [
        this.transaction?.account_id || (this.accounts[0]?.id ?? null),
        [Validators.required],
      ],
      type: [this.transaction?.type || 'expense', [Validators.required]],
      category: [this.transaction?.category || '', [Validators.required]],
      subcategory: [this.transaction?.subcategory || null],
      method: [this.transaction?.method || '', [Validators.required]],
      description: [this.transaction?.description || '', [Validators.required]],
      person: [this.transaction?.person || '', [Validators.required]],
      partner_id: [this.transaction?.partner_id ?? null],
    });

    this.selectedCategoryName.set(this.form.get('category')?.value || '');

    this.form.get('type')?.valueChanges.subscribe((type: TransactionCategoryType) => {
      this.form.get('category')?.setValue('');
      this.form.get('subcategory')?.setValue(null);
      this.selectedCategoryName.set('');
      this.selectedType.set(type);
    });

    this.form.get('category')?.valueChanges.subscribe((name: string) => {
      this.selectedCategoryName.set(name || '');
      this.form.get('subcategory')?.setValue(null);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accounts'] && this.form && !this.transaction) {
      const current = this.form.get('account_id')?.value;
      if (!current && this.accounts.length > 0) {
        this.form.get('account_id')?.setValue(this.accounts[0].id);
      }
    }

    if (changes['incomeCategories']) {
      this.incomeCategoriesSig.set(this.incomeCategories);
    }
    if (changes['expenseCategories']) {
      this.expenseCategoriesSig.set(this.expenseCategories);
    }
  }

  private todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: TransactionPayload = this.form.value;
    this.submitted.emit(payload);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
