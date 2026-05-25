import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Account, AccountPayload } from '../../../core/models/account.model';

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-form.component.html',
  styleUrls: ['./account-form.component.scss']
})
export class AccountFormComponent implements OnInit {
  @Input() account: Account | null = null;
  @Output() submitted = new EventEmitter<AccountPayload>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  isEdit = signal(false);

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.isEdit.set(!!this.account);

    this.form = this.fb.group({
      name: [this.account?.name || '', [Validators.required, Validators.maxLength(100)]],
      type: [this.account?.type || 'cash', [Validators.required]],
      description: [this.account?.description || '', [Validators.maxLength(1000)]],
      initial_balance: [this.account?.initial_balance ?? 0, [Validators.required]],
      is_active: [this.account ? this.account.is_active : true]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const payload: AccountPayload = this.form.getRawValue();
    this.submitted.emit(payload);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
