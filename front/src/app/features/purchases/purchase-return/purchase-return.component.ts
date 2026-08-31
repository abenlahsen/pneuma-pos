import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PurchaseService } from '../data-access/purchase.service';
import { AccountService } from '../../../core/services/account.service';
import { Account } from '../../../core/models/account.model';
import { Purchase, PurchaseItem, PurchaseReturn } from '../models/purchase.model';
import { PAYMENT_METHODS } from '../../../core/constants/payment-method.constants';

interface ReturnLine {
  item: PurchaseItem;
  label: string;
  alreadyReturned: number;
  remaining: number;
  quantity: number;
}

@Component({
  selector: 'app-purchase-return',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-return.component.html',
  styleUrl: './purchase-return.component.scss',
})
export class PurchaseReturnComponent implements OnInit {
  @Input({ required: true }) purchase!: Purchase;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly paymentMethods = PAYMENT_METHODS;

  // Constructor injection (not inject()) so this component can be instantiated
  // directly with plain mocks in specs, matching this codebase's no-TestBed
  // convention (see purchase-return.component.spec.ts).
  constructor(
    private purchaseService: PurchaseService,
    private accountService: AccountService,
  ) {}

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal('');

  lines = signal<ReturnLine[]>([]);
  reason = signal('');
  date = signal(new Date().toISOString().slice(0, 10));

  paidAmount = signal(0);
  alreadyRefunded = signal(0);
  accounts = signal<Account[]>([]);

  refundEnabled = signal(false);
  refundAmount = signal(0);
  refundAccountId = signal(0);
  refundDate = signal(new Date().toISOString().slice(0, 10));
  refundMethod = signal('Espèces');

  readonly totalQuantity = computed(() => this.lines().reduce((sum, l) => sum + (l.quantity || 0), 0));
  readonly totalAmount = computed(() => this.lines().reduce((sum, l) => sum + (l.quantity || 0) * l.item.unit_price, 0));
  readonly availableToRefund = computed(() => Math.max(0, round2(this.paidAmount() - this.alreadyRefunded())));
  readonly canSubmitRefund = computed(() => this.paidAmount() - this.alreadyRefunded() > 0.01);

  ngOnInit(): void {
    forkJoin({
      purchase: this.purchaseService.getPurchase(this.purchase.id),
      returns: this.purchaseService.getReturns(this.purchase.id),
    }).subscribe({
      next: ({ purchase, returns }) => {
        const returnedByItem = new Map<number, number>();
        for (const ret of returns) {
          for (const line of ret.items || []) {
            returnedByItem.set(line.purchase_item_id, (returnedByItem.get(line.purchase_item_id) || 0) + line.quantity);
          }
        }

        this.lines.set(
          (purchase.items || [])
            .map((item) => {
              const alreadyReturned = returnedByItem.get(item.id!) || 0;
              const remaining = Math.max(0, item.quantity - alreadyReturned);
              return {
                item,
                label: this.formatLabel(item),
                alreadyReturned,
                remaining,
                quantity: 0,
              };
            })
            .filter((line) => line.remaining > 0),
        );

        this.paidAmount.set((purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0));
        this.alreadyRefunded.set(returns.reduce((sum, r) => sum + Number(r.refund_amount), 0));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Erreur lors du chargement de l'achat.");
        this.loading.set(false);
      },
    });

    this.accountService.getAccounts().subscribe({
      next: (data) => this.accounts.set(data.filter((a: Account) => a.is_active)),
    });
  }

  private formatLabel(item: PurchaseItem): string {
    const product: any = item.linkedProduct || item.linked_product;
    if (!product) return `Produit #${item.product_id}`;
    if (product.type !== 'tyre') return product.reference || `Produit #${item.product_id}`;

    const parts = [product.brand?.name, product.profile].filter(Boolean);
    let label = parts.join(' ') || product.reference || `Produit #${item.product_id}`;
    const t = product.tyre;
    if (t?.tire_width && t?.tire_height && t?.tire_diameter) {
      label += ` — ${t.tire_width}/${t.tire_height}R${t.tire_diameter}`;
    }
    return label;
  }

  setQuantity(line: ReturnLine, value: number): void {
    const quantity = Math.max(0, Math.min(line.remaining, Math.floor(value) || 0));
    this.lines.update((arr) => arr.map((l) => (l === line ? { ...l, quantity } : l)));
  }

  returnAllRemaining(): void {
    this.lines.update((arr) => arr.map((l) => ({ ...l, quantity: l.remaining })));
  }

  toggleRefund(enabled: boolean): void {
    this.refundEnabled.set(enabled);
    if (enabled) {
      this.refundAmount.set(Math.min(this.availableToRefund(), round2(this.totalAmount())));
      if (!this.refundAccountId() && this.accounts().length > 0) {
        this.refundAccountId.set(this.accounts()[0].id);
      }
    }
  }

  submit(): void {
    if (this.submitting()) return;

    const items = this.lines()
      .filter((l) => l.quantity > 0)
      .map((l) => ({ purchase_item_id: l.item.id!, quantity: l.quantity }));

    if (items.length === 0) {
      this.errorMessage.set('Indiquez au moins une quantité à retourner.');
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);

    this.purchaseService
      .createReturn(this.purchase.id, {
        date: this.date(),
        reason: this.reason() || null,
        items,
        refund: this.refundEnabled()
          ? {
              amount: this.refundAmount(),
              account_id: this.refundAccountId(),
              date: this.refundDate(),
              method: this.refundMethod(),
            }
          : null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(extractErrorMessage(err));
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractErrorMessage(err: any): string {
  const errors = err?.error?.errors;
  if (errors) {
    return Object.values(errors).flat().join(' ');
  }
  return err?.error?.message || "Erreur lors de l'enregistrement du retour.";
}
