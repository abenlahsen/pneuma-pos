import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { Payment, PaymentPayload, PaymentSummary } from '../../../core/models/payment.model';
import { Sale } from '../../../core/models/sale.model';

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

  showAddForm = false;
  formData: PaymentPayload = {
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    method: 'Espèces',
    reference: '',
    notes: '',
  };

  constructor(private paymentService: PaymentService) {}

  ngOnInit() {
    this.loadPayments();
  }

  loadPayments() {
    this.loading.set(true);
    this.paymentService.getPayments(this.sale.id).subscribe({
      next: (data: PaymentSummary) => {
        this.payments.set(data.payments);
        this.totalPaid.set(data.total_paid);
        this.totalSale.set(data.total_sale);
        this.remaining.set(data.remaining);
        this.paymentStatus.set(data.payment_status);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get progressPercent(): number {
    return this.totalSale() > 0 ? Math.min(100, (this.totalPaid() / this.totalSale()) * 100) : 0;
  }

  openAddForm() {
    this.formData = {
      amount: this.remaining() > 0 ? this.remaining() : 0,
      date: new Date().toISOString().slice(0, 10),
      method: 'Espèces',
      reference: '',
      notes: '',
    };
    this.showAddForm = true;
  }

  submitPayment() {
    if (this.formData.amount <= 0) return;
    this.paymentService.addPayment(this.sale.id, this.formData).subscribe({
      next: () => {
        this.showAddForm = false;
        this.loadPayments();
        this.statusChanged.emit();
      },
    });
  }

  deletePayment(payment: Payment) {
    if (!confirm('Supprimer ce paiement ?')) return;
    this.paymentService.deletePayment(this.sale.id, payment.id).subscribe({
      next: () => {
        this.loadPayments();
        this.statusChanged.emit();
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
