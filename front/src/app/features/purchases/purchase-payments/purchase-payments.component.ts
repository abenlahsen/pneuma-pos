import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../../core/services/purchase.service';
import { Purchase, PurchasePayment, PurchasePaymentSummary } from '../../../core/models/purchase.model';

@Component({
  selector: 'app-purchase-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  showAddForm = false;
  formData: any = {
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    method: 'Espèces',
    notes: '',
  };

  constructor(private purchaseService: PurchaseService) {}

  ngOnInit() {
    this.loadPayments();
  }

  loadPayments() {
    this.loading.set(true);
    this.purchaseService.getPurchasePayments(this.purchase.id).subscribe({
      next: (data: PurchasePaymentSummary) => {
        this.payments.set(data.payments);
        this.totalPaid.set(data.total_paid);
        this.totalPurchase.set(data.total_purchase);
        this.remaining.set(data.remaining);
        this.paymentStatus.set(data.payment_status);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get progressPercent(): number {
    return this.totalPurchase() > 0 ? Math.min(100, (this.totalPaid() / this.totalPurchase()) * 100) : 0;
  }

  openAddForm() {
    this.formData = {
      amount: this.remaining() > 0 ? this.remaining() : 0,
      date: new Date().toISOString().slice(0, 10),
      method: 'Espèces',
      notes: '',
    };
    this.showAddForm = true;
  }

  submitPayment() {
    if (this.formData.amount <= 0) return;
    this.purchaseService.addPurchasePayment(this.purchase.id, this.formData).subscribe({
      next: () => {
        this.showAddForm = false;
        this.loadPayments();
        this.statusChanged.emit();
      },
    });
  }

  deletePayment(payment: PurchasePayment) {
    if (!confirm('Supprimer ce paiement ?')) return;
    this.purchaseService.deletePurchasePayment(this.purchase.id, payment.id).subscribe({
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
