import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../../core/services/purchase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Purchase, PurchasePayment, PurchasePaymentSummary } from '../../../core/models/purchase.model';
import { Account } from '../../../core/models/account.model';
import { AccountService } from '../../../core/services/account.service';
import { PurchasePaymentDetailComponent } from '../components/purchase-payment-detail/purchase-payment-detail.component';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-purchase-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, PurchasePaymentDetailComponent],
  templateUrl: './purchase-payments.component.html',
  styleUrl: './purchase-payments.component.scss',
})
export class PurchasePaymentsComponent implements OnInit {
  @Input() purchase!: Purchase;
  @Output() closed = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<string>();

  payments = signal<PurchasePayment[]>([]);
  totalPaid = signal(0);
  totalPurchase = signal(0);
  remaining = signal(0);
  paymentStatus = signal('');
  loading = signal(true);
  submitting = signal(false);
  accounts = signal<Account[]>([]);
  viewingPaymentId = signal<number | null>(null);

  readonly paymentMethods = PAYMENT_METHODS;
  showAddForm = false;
  formData: {
    amount: number;
    date: string;
    method: string;
    reference: string;
    notes: string;
    account_id: number;
  } = {
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    method: 'Espèces',
    reference: '',
    notes: '',
    account_id: 0,
  };

  constructor(
    private purchaseService: PurchaseService,
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
    this.purchaseService.getPurchasePayments(this.purchase.id).subscribe({
      next: (data: PurchasePaymentSummary) => {
        this.payments.set(data.payments);
        this.totalPaid.set(data.total_paid);
        this.totalPurchase.set(data.total_purchase);
        this.remaining.set(data.remaining);
        this.paymentStatus.set(data.payment_status);
        this.loading.set(false);
        onComplete?.();
      },
      error: () => this.loading.set(false),
    });
  }

  get progressPercent(): number {
    const total = this.totalPurchase();
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
    this.purchaseService.addPurchasePayment(this.purchase.id, this.formData).subscribe({
      next: () => {
        this.showAddForm = false;
        this.submitting.set(false);
        this.statusChanged.emit();
        this.loadPayments(() => { if (this.remaining() <= 0) this.close(); });
      },
      error: () => this.submitting.set(false),
    });
  }

  deletePayment(payment: PurchasePayment): void {
    if (!confirm('Supprimer ce paiement ?')) return;
    this.purchaseService.deletePurchasePayment(this.purchase.id, payment.id).subscribe({
      next: () => {
        this.loadPayments();
        this.statusChanged.emit();
      },
    });
  }

  openView(payment: PurchasePayment): void {
    this.viewingPaymentId.set(payment.id);
  }

  closeView(): void {
    this.viewingPaymentId.set(null);
  }

  close(): void {
    this.closed.emit();
  }
}
