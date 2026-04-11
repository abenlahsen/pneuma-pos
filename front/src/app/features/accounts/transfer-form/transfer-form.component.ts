import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Account, TransferPayload } from '../../../core/models/account.model';

@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transfer-form.component.html',
  styleUrls: ['../../../features/cash-flow/transaction-form/transaction-form.component.scss']
})
export class TransferFormComponent implements OnInit {
  @Input() accounts: Account[] = [];
  @Output() submitted = new EventEmitter<TransferPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    const activeAccounts = this.accounts.filter(a => a.is_active);

    this.form = this.fb.group({
      source_account_id: ['', [Validators.required]],
      destination_account_id: ['', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [this.todayDate(), [Validators.required]],
      description: ['']
    });
  }

  private todayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get activeAccounts() {
    return this.accounts.filter(a => a.is_active);
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    if (this.form.value.source_account_id === this.form.value.destination_account_id) {
      alert("Le compte source et le compte de destination doivent être différents.");
      return;
    }

    const payload: TransferPayload = this.form.value;
    this.submitted.emit(payload);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
