import { Component, EventEmitter, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Account } from '../../../accounts/models/account.model';
import { Transaction, TransactionFilters, TransactionPayload } from '../../models/transaction.model';

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
  @Output() submitted = new EventEmitter<TransactionPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  isEdit = signal(false);

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.isEdit.set(!!this.transaction);

    this.form = this.fb.group({
      date: [this.transaction?.date || this.todayDate(), [Validators.required]],
      amount: [this.transaction?.amount || null, [Validators.required, Validators.min(0.01)]],
      account_id: [
        this.transaction?.account_id || (this.accounts[0]?.id ?? null),
        [Validators.required],
      ],
      type: [this.transaction?.type || 'expense', [Validators.required]],
      category: [this.transaction?.category || '', [Validators.required]],
      method: [this.transaction?.method || '', [Validators.required]],
      description: [this.transaction?.description || '', [Validators.required]],
      person: [this.transaction?.person || '', [Validators.required]],
      partner: [this.transaction?.partner || ''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accounts'] && this.form && !this.transaction) {
      const current = this.form.get('account_id')?.value;
      if (!current && this.accounts.length > 0) {
        this.form.get('account_id')?.setValue(this.accounts[0].id);
      }
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
