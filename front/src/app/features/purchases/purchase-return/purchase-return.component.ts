import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IconComponent } from '../../../shared/icon/icon.component';
import { SidePanelComponent } from '../../../shared/side-panel/side-panel.component';
import { PurchaseService } from '../data-access/purchase.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { AccountService } from '../../../core/services/account.service';
import { Account } from '../../../core/models/account.model';
import { Purchase, PurchaseItem } from '../models/purchase.model';
import { PAYMENT_METHODS } from '../../../core/constants/payment-method.constants';

export interface ReturnLine {
  item: PurchaseItem;
  /** Marque et profil — ou la référence d'une pièce. */
  name: string;
  /** Dimension d'un pneu, vide sinon. */
  dimension: string;
  isTyre: boolean;
  alreadyReturned: number;
  remaining: number;
  quantity: number;
}

/** Contrepartie du retour (20c) : déduire du dû, ou un remboursement reçu. */
export type ReturnCounterpart = 'deduct' | 'refund';

/**
 * Motifs proposés. Le backend garde un texte libre (`reason`, 1000 car.) :
 * la liste n'est qu'une aide à la saisie, et « Autre » rouvre le texte libre.
 */
export const RETURN_REASONS = ['Défaut de fabrication', 'Erreur de livraison', 'Invendu'] as const;
export const OTHER_REASON = 'Autre';

/**
 * Ce que le retour fait au reste dû de l'achat, sans remboursement.
 *
 * Même calcul que le backend (Purchase::effectiveNetAmount et
 * SupplierService::calcOutstanding) : le retour, brut, est ramené au net par
 * la remise de l'achat puis retiré du coût effectif ; le reste dû est ce coût
 * moins ce qui a été payé et pas remboursé, jamais négatif. Un achat déjà
 * réglé ne descend donc pas sous zéro : l'excédent n'est reporté nulle part.
 */
export function returnDueEffect(p: {
  effectiveNet: number;
  netPaid: number;
  discountPct: number;
  returnGross: number;
}): { before: number; after: number; deducted: number; lost: number } {
  const factor = Math.max(0, 1 - (p.discountPct || 0) / 100);
  const returnNet = round2(p.returnGross * factor);
  const before = Math.max(0, round2(p.effectiveNet - p.netPaid));
  const after = Math.max(0, round2(Math.max(0, p.effectiveNet - returnNet) - p.netPaid));
  const deducted = round2(before - after);
  return { before, after, deducted, lost: Math.max(0, round2(returnNet - deducted)) };
}

/**
 * Le retour fournisseur — refonte 2b, 12c.
 *
 * Quitte sa modale pour le volet 15d, par-dessus la fiche d'achat : quatre
 * colonnes (article, retournable, compteur à retourner, montant), date et
 * motif côte à côte, puis la contrepartie en choix segmenté. L'API ne change
 * pas : un retour sans `refund` est déjà imputé sur le dû (12.0, point 2).
 */
@Component({
  selector: 'app-purchase-return',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, SidePanelComponent],
  templateUrl: './purchase-return.component.html',
  styleUrl: './purchase-return.component.scss',
})
export class PurchaseReturnComponent implements OnInit {
  @Input({ required: true }) purchase!: Purchase;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly paymentMethods = PAYMENT_METHODS;
  readonly reasons = RETURN_REASONS;
  readonly otherReason = OTHER_REASON;

  // Constructor injection (not inject()) so this component can be instantiated
  // directly with plain mocks in specs, matching this codebase's no-TestBed
  // convention (see purchase-return.component.spec.ts).
  constructor(
    private purchaseService: PurchaseService,
    private accountService: AccountService,
    private supplierService: SupplierService,
  ) {}

  loading = signal(true);
  submitting = signal(false);
  errorMessage = signal('');

  lines = signal<ReturnLine[]>([]);
  date = signal(new Date().toISOString().slice(0, 10));
  reasonChoice = signal<string>(RETURN_REASONS[0]);
  reasonOther = signal('');

  /** L'achat tel que relu à l'ouverture : nom du fournisseur, remise, net effectif. */
  loaded = signal<Purchase | null>(null);
  paidAmount = signal(0);
  alreadyRefunded = signal(0);
  /** Dû total au fournisseur, tous achats confondus ; null si le profil n'a pas pu être lu. */
  supplierDue = signal<number | null>(null);
  accounts = signal<Account[]>([]);

  counterpart = signal<ReturnCounterpart>('deduct');
  refundAmount = signal(0);
  refundAccountId = signal(0);
  refundDate = signal(new Date().toISOString().slice(0, 10));
  refundMethod = signal('Espèces');

  /** Compatibilité : « Remboursement reçu » est la case cochée d'avant. */
  readonly refundEnabled = computed(() => this.counterpart() === 'refund');

  readonly totalQuantity = computed(() => this.lines().reduce((sum, l) => sum + (l.quantity || 0), 0));
  readonly totalAmount = computed(() => round2(this.lines().reduce((sum, l) => sum + (l.quantity || 0) * l.item.unit_price, 0)));
  readonly availableToRefund = computed(() => Math.max(0, round2(this.paidAmount() - this.alreadyRefunded())));
  readonly canSubmitRefund = computed(() => this.paidAmount() - this.alreadyRefunded() > 0.01);

  /** « 4 pneus retournés » quand tout est pneu, « articles » sinon. */
  readonly totalLabel = computed(() => {
    const n = this.totalQuantity();
    const picked = this.lines().filter(l => l.quantity > 0);
    const noun = picked.length > 0 && picked.every(l => l.isTyre) ? 'pneu' : 'article';
    return `${n} ${noun}${n > 1 ? 's' : ''} retourné${n > 1 ? 's' : ''}`;
  });

  readonly supplierName = computed(() => this.loaded()?.supplier?.name || this.purchase?.supplier?.name || 'Fournisseur');

  readonly panelTitle = computed(() => `Achat ${this.purchase.id} · ${this.supplierName()}`);

  /** L'effet du retour sur le reste dû de cet achat (déduire du dû). */
  readonly dueEffect = computed(() => {
    const p = this.loaded();
    const effectiveNet = Number(p?.effective_net_amount ?? p?.net_amount ?? 0);
    return returnDueEffect({
      effectiveNet,
      netPaid: round2(this.paidAmount() - this.alreadyRefunded()),
      discountPct: Number(p?.discount ?? 0),
      returnGross: this.totalAmount(),
    });
  });

  /** Le dû au fournisseur, avant et après ; null sans profil fournisseur. */
  readonly supplierDueAfter = computed(() => {
    const due = this.supplierDue();
    return due === null ? null : Math.max(0, round2(due - this.dueEffect().deducted));
  });

  /** Le motif envoyé : l'option choisie, ou le texte libre sous « Autre ». */
  readonly reason = computed(() => {
    const choice = this.reasonChoice();
    if (choice !== OTHER_REASON) return choice;
    return this.reasonOther().trim() || null;
  });

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
              return {
                item,
                ...this.describe(item),
                alreadyReturned,
                remaining: Math.max(0, item.quantity - alreadyReturned),
                quantity: 0,
              };
            })
            .filter((line) => line.remaining > 0),
        );

        const refunded = returns.reduce((sum, r) => sum + Number(r.refund_amount), 0);
        this.alreadyRefunded.set(refunded);
        // `paid_amount` (fiche d'achat) est déjà net des remboursements et lu
        // sur les affectations, comme le contrôle du backend ; les paiements
        // bruts ne servent que si la fiche ne le donne pas.
        this.paidAmount.set(
          purchase.paid_amount != null
            ? round2(Number(purchase.paid_amount) + refunded)
            : (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0),
        );
        this.loaded.set(purchase);
        this.loading.set(false);
        this.loadSupplierDue(purchase.supplier?.id ?? (purchase as any).supplier_id);
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

  private loadSupplierDue(supplierId: number | null | undefined): void {
    if (!supplierId) return;
    this.supplierService
      .getSupplierProfile(supplierId)
      .pipe(catchError(() => of(null)))
      .subscribe((profile) => {
        if (profile) this.supplierDue.set(Number(profile.outstanding_balance) || 0);
      });
  }

  private describe(item: PurchaseItem): Pick<ReturnLine, 'name' | 'dimension' | 'isTyre'> {
    const product: any = item.linkedProduct || item.linked_product;
    if (!product) return { name: `Produit #${item.product_id}`, dimension: '', isTyre: false };
    if (product.type !== 'tyre') {
      return { name: product.reference || `Produit #${item.product_id}`, dimension: '', isTyre: false };
    }
    const name = [product.brand?.name, product.profile].filter(Boolean).join(' ') || product.reference || `Produit #${item.product_id}`;
    const t = product.tyre;
    const dimension = t?.tire_width && t?.tire_height && t?.tire_diameter ? `${t.tire_width}/${t.tire_height}R${t.tire_diameter}` : '';
    return { name, dimension, isTyre: true };
  }

  setQuantity(line: ReturnLine, value: number): void {
    const quantity = Math.max(0, Math.min(line.remaining, Math.floor(value) || 0));
    this.lines.update((arr) => arr.map((l) => (l.item.id === line.item.id ? { ...l, quantity } : l)));
  }

  /** Le compteur − / + ; borné entre 0 et le retournable. */
  step(line: ReturnLine, delta: number): void {
    this.setQuantity(line, line.quantity + delta);
  }

  returnAllRemaining(): void {
    this.lines.update((arr) => arr.map((l) => ({ ...l, quantity: l.remaining })));
  }

  setCounterpart(value: ReturnCounterpart): void {
    if (value === 'refund' && !this.canSubmitRefund()) return;
    this.counterpart.set(value);
    if (value === 'refund') {
      this.refundAmount.set(Math.min(this.availableToRefund(), this.totalAmount()));
      if (!this.refundAccountId() && this.accounts().length > 0) {
        this.refundAccountId.set(this.accounts()[0].id);
      }
    }
  }

  /** Ancienne case « Remboursement » : conservée pour les appels existants. */
  toggleRefund(enabled: boolean): void {
    this.setCounterpart(enabled ? 'refund' : 'deduct');
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
        reason: this.reason(),
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
