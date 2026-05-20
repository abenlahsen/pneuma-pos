import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceOrder, ServicePayment, ServicePaymentPayload } from '../../../core/models/service-order.model';
import { ServiceOrderService } from '../data-access/service-order.service';
import { AuthService } from '../../../core/services/auth.service';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Carte bancaire'];

interface AccountOption {
  id: number;
  name: string;
  type: string;
}

@Component({
  selector: 'app-service-payment-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-payment-panel.component.html',
  styleUrls: ['./service-payment-panel.component.scss'],
})
export class ServicePaymentPanelComponent implements OnInit {
  @Input() serviceOrder!: ServiceOrder;
  @Output() closed = new EventEmitter<void>();

  payments = signal<ServicePayment[]>([]);
  totalPaid = signal(0);
  totalAmount = signal(0);
  remaining = signal(0);
  paymentStatus = signal('');
  loading = signal(true);
  submitting = signal(false);
  accounts = signal<AccountOption[]>([]);

  readonly paymentMethods = PAYMENT_METHODS;
  showAddForm = false;

  formData: ServicePaymentPayload = {
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    method: 'Espèces',
    reference: '',
    notes: '',
    account_id: null,
  };

  constructor(
    private serviceOrderService: ServiceOrderService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadPayments();
    this.serviceOrderService.getFilters().subscribe(f => {
      this.accounts.set(f.accounts ?? []);
    });
  }

  loadPayments(onComplete?: () => void): void {
    this.loading.set(true);
    this.serviceOrderService.getPayments(this.serviceOrder.id).subscribe({
      next: (data) => {
        this.payments.set(data.payments);
        this.totalPaid.set(data.total_paid);
        this.totalAmount.set(data.total_amount);
        this.remaining.set(data.remaining);
        this.paymentStatus.set(data.payment_status);
        this.loading.set(false);
        onComplete?.();
      },
      error: () => this.loading.set(false),
    });
  }

  openAddForm(): void {
    this.formData = {
      amount: Math.max(0, this.remaining()),
      date: new Date().toISOString().slice(0, 10),
      method: 'Espèces',
      reference: '',
      notes: '',
      account_id: null,
    };
    this.showAddForm = true;
  }

  submitPayment(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.serviceOrderService.addPayment(this.serviceOrder.id, this.formData).subscribe({
      next: () => {
        this.showAddForm = false;
        this.submitting.set(false);
        this.loadPayments(() => { if (this.remaining() <= 0) this.close(); });
      },
      error: () => this.submitting.set(false),
    });
  }

  deletePayment(payment: ServicePayment): void {
    if (!confirm('Supprimer ce paiement ?')) return;
    this.serviceOrderService.deletePayment(this.serviceOrder.id, payment.id).subscribe({
      next: () => this.loadPayments(),
    });
  }

  get progressPercent(): number {
    const total = this.totalAmount();
    if (!total) return 0;
    return Math.min(100, Math.round((this.totalPaid() / total) * 100));
  }

  close(): void {
    this.closed.emit();
  }
}
