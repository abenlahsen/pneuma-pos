import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../../data-access/client.service';
import { UnpaidSaleRow, ClientPaymentPayload } from '../../models/client.model';
import { Account } from '../../../../core/models/account.model';
import { AccountService } from '../../../../core/services/account.service';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-client-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-payment.component.html',
  styleUrl: './client-payment.component.scss',
})
export class ClientPaymentComponent implements OnInit {
  @Input() clientId!: number;
  @Input() clientName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly paymentMethods = PAYMENT_METHODS;

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal('');
  unpaidSales = signal<UnpaidSaleRow[]>([]);
  accounts = signal<Account[]>([]);
  allocationAmounts = signal<Record<number, number>>({});
  filterWithInvoice = signal<'' | '1' | '0'>('');

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

  readonly visibleSales = computed(() => {
    const filter = this.filterWithInvoice();
    if (filter === '') return this.unpaidSales();
    const wantInvoice = filter === '1';
    return this.unpaidSales().filter((s) => s.with_invoice === wantInvoice);
  });

  constructor(
    private clientService: ClientService,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.clientService.getUnpaidSales(this.clientId).subscribe({
      next: (data) => {
        this.unpaidSales.set(data.sales);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger les ventes non soldées.');
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

  getAllocation(saleId: number): number {
    return this.allocationAmounts()[saleId] ?? 0;
  }

  setAllocation(saleId: number, value: number): void {
    this.allocationAmounts.update((m) => ({ ...m, [saleId]: Math.max(0, value || 0) }));
  }

  /** Fill this sale's allocation with its full remaining balance and adjust the total accordingly. */
  useFullAmount(sale: UnpaidSaleRow): void {
    this.setAllocation(sale.id, sale.remaining);
    this.totalAmount = Math.round(this.allocatedTotal() * 100) / 100;
  }

  setFilterWithInvoice(value: '' | '1' | '0'): void {
    this.filterWithInvoice.set(value);
    this.allocationAmounts.set({});
  }

  /** Auto-distribute the total amount across the visible unpaid sales, oldest first. */
  onTotalAmountChange(): void {
    let remaining = Math.round((this.totalAmount || 0) * 100) / 100;
    const next: Record<number, number> = {};

    for (const s of this.visibleSales()) {
      if (remaining <= 0) {
        next[s.id] = 0;
        continue;
      }
      const alloc = Math.min(s.remaining, remaining);
      next[s.id] = Math.round(alloc * 100) / 100;
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
      .map(([saleId, amount]) => ({ sale_id: Number(saleId), amount: amount || 0 }))
      .filter((row) => row.amount > 0);

    const payload: ClientPaymentPayload = {
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
    this.clientService.createClientPayment(this.clientId, payload).subscribe({
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
