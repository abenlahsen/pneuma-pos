import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../data-access/supplier.service';
import { UnpaidPurchaseRow, SupplierPaymentPayload } from '../../models/supplier.model';
import { Account } from '../../../../core/models/account.model';
import { AccountService } from '../../../../core/services/account.service';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-supplier-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-payment.component.html',
  styleUrl: './supplier-payment.component.scss',
})
export class SupplierPaymentComponent implements OnInit {
  @Input() supplierId!: number;
  @Input() supplierName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly paymentMethods = PAYMENT_METHODS;

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal('');
  unpaidPurchases = signal<UnpaidPurchaseRow[]>([]);
  accounts = signal<Account[]>([]);
  allocationAmounts = signal<Record<number, number>>({});

  totalAmount = 0;
  method = 'Espèces';
  date = new Date().toISOString().slice(0, 10);
  accountId = 0;
  reference = '';
  notes = '';

  readonly allocatedTotal = computed(() =>
    Object.values(this.allocationAmounts()).reduce((sum, v) => sum + (v || 0), 0)
  );

  readonly allocationMismatch = computed(() => Math.abs(this.allocatedTotal() - this.totalAmount) > 0.01);

  constructor(
    private supplierService: SupplierService,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.supplierService.getUnpaidPurchases(this.supplierId).subscribe({
      next: (data) => {
        this.unpaidPurchases.set(data.purchases);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Impossible de charger les achats non soldés.");
        this.loading.set(false);
      },
    });
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        const active = data.filter((a: Account) => a.is_active);
        this.accounts.set(active);
        if (active.length > 0) this.accountId = active[0].id;
      },
    });
  }

  getAllocation(purchaseId: number): number {
    return this.allocationAmounts()[purchaseId] ?? 0;
  }

  setAllocation(purchaseId: number, value: number): void {
    this.allocationAmounts.update((m) => ({ ...m, [purchaseId]: Math.max(0, value || 0) }));
  }

  /** Fill this purchase's allocation with its full remaining balance and adjust the total accordingly. */
  useFullAmount(purchase: UnpaidPurchaseRow): void {
    this.setAllocation(purchase.id, purchase.remaining);
    this.totalAmount = Math.round(this.allocatedTotal() * 100) / 100;
  }

  /** Auto-distribute the total amount across unpaid purchases, oldest first. */
  onTotalAmountChange(): void {
    let remaining = Math.round((this.totalAmount || 0) * 100) / 100;
    const next: Record<number, number> = {};

    for (const p of this.unpaidPurchases()) {
      if (remaining <= 0) {
        next[p.id] = 0;
        continue;
      }
      const alloc = Math.min(p.remaining, remaining);
      next[p.id] = Math.round(alloc * 100) / 100;
      remaining = Math.round((remaining - alloc) * 100) / 100;
    }

    this.allocationAmounts.set(next);
  }

  canSubmit(): boolean {
    if (this.submitting()) return false;
    if (!this.totalAmount || this.totalAmount <= 0) return false;
    if (!this.date || !this.accountId) return false;
    if (this.allocationMismatch()) return false;
    return this.allocatedTotal() > 0;
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const allocations = Object.entries(this.allocationAmounts())
      .map(([purchaseId, amount]) => ({ purchase_id: Number(purchaseId), amount: amount || 0 }))
      .filter((row) => row.amount > 0);

    const payload: SupplierPaymentPayload = {
      amount: this.totalAmount,
      method: this.method,
      date: this.date,
      account_id: this.accountId,
      reference: this.reference || null,
      notes: this.notes || null,
      allocations,
    };

    this.submitting.set(true);
    this.errorMessage.set('');
    this.supplierService.createSupplierPayment(this.supplierId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
        this.closed.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message || "Impossible d'enregistrer le paiement.");
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
