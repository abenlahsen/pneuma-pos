import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { Payment, PaymentPayload, PaymentSummary } from '../../../core/models/payment.model';
import { Sale } from '../../../core/models/sale.model';
import { Account } from '../../../core/models/account.model';
import { AccountService } from '../../../core/services/account.service';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-payment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-panel.component.html',
  styleUrl: './payment-panel.component.scss',
})
export class PaymentPanelComponent implements OnInit {
  @Input() sale!: Sale;
  @Output() closed = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<string>();

  payments = signal<Payment[]>([]);
  totalPaid = signal(0);
  totalSale = signal(0);
  remaining = signal(0);
  paymentStatus = signal('');
  loading = signal(true);
  submitting = signal(false);
  accounts = signal<Account[]>([]);

  readonly paymentMethods = PAYMENT_METHODS;
  showAddForm = false;
  formData: PaymentPayload = {
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    method: 'Espèces',
    reference: '',
    notes: '',
    account_id: 0,
  };

  constructor(
    private paymentService: PaymentService,
    private accountService: AccountService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadPayments();
    this.accountService.getAccounts().subscribe({
      next: (data) => this.accounts.set(data.filter((a: Account) => a.is_active)),
    });
  }

  loadPayments(onComplete?: () => void): void {
    this.loading.set(true);
    this.paymentService.getPayments(this.sale.id).subscribe({
      next: (data: PaymentSummary) => {
        this.payments.set(data.payments);
        this.totalPaid.set(data.total_paid);
        this.totalSale.set(data.total_sale);
        this.remaining.set(data.remaining);
        this.paymentStatus.set(data.payment_status);
        this.loading.set(false);
        onComplete?.();
      },
      error: () => this.loading.set(false),
    });
  }

  get progressPercent(): number {
    const total = this.totalSale();
    if (!total) return 0;
    return Math.min(100, Math.round((this.totalPaid() / total) * 100));
  }

  openAddForm(): void {
    this.formData = {
      amount: Math.max(0, this.remaining()),
      date: new Date().toISOString().slice(0, 10),
      method: 'Espèces',
      reference: '',
      notes: '',
      account_id: this.accounts().length > 0 ? this.accounts()[0].id : 0,
    };
    this.showAddForm = true;
  }

  submitPayment(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.paymentService.addPayment(this.sale.id, this.formData).subscribe({
      next: () => {
        this.showAddForm = false;
        this.submitting.set(false);
        this.statusChanged.emit();
        this.loadPayments(() => { if (this.remaining() <= 0) this.close(); });
      },
      error: () => this.submitting.set(false),
    });
  }

  deletePayment(payment: Payment): void {
    if (!confirm('Supprimer ce paiement ?')) return;
    this.paymentService.deletePayment(this.sale.id, payment.id).subscribe({
      next: () => {
        this.loadPayments();
        this.statusChanged.emit();
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
