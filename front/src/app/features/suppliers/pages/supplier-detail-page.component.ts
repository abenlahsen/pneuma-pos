import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SupplierService } from '../data-access/supplier.service';
import { SupplierFormComponent } from '../components/supplier-form/supplier-form.component';
import { SupplierPaymentComponent } from '../components/supplier-payment/supplier-payment.component';
import { PurchasePaymentDetailComponent } from '../../purchases/components/purchase-payment-detail/purchase-payment-detail.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import {
  Supplier,
  SupplierPayload,
  SupplierProfileResponse,
  SupplierStatementResponse,
  SupplierStatementEntry,
  SupplierStatementPayment,
  PurchaseHistoryRow,
} from '../models/supplier.model';

/** Les quatre tranches d'ancienneté du règlement, dans l'ordre de lecture. */
export type SettlementBucket = '0-30' | '31-60' | '61-90' | '90+';

/**
 * Les vues du registre. Contrairement à la fiche client, « Avoirs » existe
 * ici : les retours fournisseur remboursés apparaissent au relevé comme des
 * écritures de type 'refund'.
 */
export type SupplierScope = 'all' | 'due' | 'payments' | 'refunds';

/**
 * Seuil de risque légal, en jours. Même valeur que l'écran Achats et que
 * DashboardTodoService::OLD_DEBT_DAYS — au-delà, un règlement en retard n'est
 * plus une question de trésorerie mais de conformité.
 */
const LEGAL_RISK_DAYS = 90;

@Component({
  selector: 'app-supplier-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SupplierFormComponent, SupplierPaymentComponent, PurchasePaymentDetailComponent, IconComponent, ConfirmDeleteComponent],
  templateUrl: './supplier-detail-page.component.html',
  styleUrl: './supplier-detail-page.component.scss',
})
export class SupplierDetailPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supplierService = inject(SupplierService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);

  activeId: number | null = null;

  readonly loading = signal(true);
  readonly profileLoading = signal(false);
  readonly statementLoading = signal(false);
  readonly errorMessage = signal('');
  readonly statementErrorMessage = signal('');

  readonly profile = signal<SupplierProfileResponse | null>(null);
  readonly statement = signal<SupplierStatementResponse | null>(null);

  readonly isPaymentModalOpen = signal(false);
  readonly deleting = signal(false);
  readonly deletingPaymentId = signal<number | null>(null);
  readonly viewingPaymentId = signal<number | null>(null);


  readonly purchasesHistory = computed<PurchaseHistoryRow[]>(() =>
    this.profile()?.purchases ?? this.statement()?.purchases ?? []
  );

  readonly statementEntries = computed<SupplierStatementEntry[]>(() =>
    this.statement()?.entries ?? []
  );

  readonly openPurchases = computed<PurchaseHistoryRow[]>(() =>
    (this.statement()?.purchases ?? []).filter(p => (p.outstanding_amount ?? 0) > 0)
  );

  /**
   * Le fournisseur, pris de la réponse qui est arrivée. Les deux requêtes sont
   * indépendantes et l'écran survit à l'échec de l'une : lire le délai
   * contractuel dans `profile` alors que les achats viennent de `statement`
   * ferait compter un retard depuis la date d'achat, délai ignoré.
   */
  readonly supplier = computed(() => this.profile()?.supplier ?? this.statement()?.supplier ?? null);

  /** Le délai que ce fournisseur accorde, ou zéro quand il n'est pas renseigné. */
  readonly contractualDays = computed(() => Number(this.supplier()?.payment_terms_days ?? 0));

  // ── Refonte 2b, 16a : les deux filtres du registre ───────────────────────
  readonly scope = signal<SupplierScope>('all');
  readonly bucket = signal<SettlementBucket | null>(null);

  /** Échec d'une action : la fiche reste affichée. */
  readonly actionError = signal('');

  readonly legalRiskDays = LEGAL_RISK_DAYS;

  readonly bucketKeys: SettlementBucket[] = ['0-30', '31-60', '61-90', '90+'];

  bucketLabel(b: SettlementBucket): string {
    return b === '90+' ? `+${LEGAL_RISK_DAYS} J` : `${b} J`;
  }

  /**
   * Le registre. Le serveur le construit déjà unifié — achats, paiements et
   * remboursements de retour — trié par date avec un solde progressif, du plus
   * récent au plus ancien. L'écran le fragmentait en trois tableaux repliables.
   */
  readonly entries = computed<SupplierStatementEntry[]>(() => this.statement()?.entries ?? []);

  /** Ce qu'on doit au fournisseur aujourd'hui — le chiffre principal. */
  readonly outstanding = computed(
    () => this.statement()?.summary?.outstanding_balance ?? this.profile()?.outstanding_balance ?? 0,
  );

  /** Identifiants des achats encore dus — sert au filtre « à régler ». */
  private readonly dueIds = computed<Set<number>>(
    () => new Set(this.openPurchases().map((p) => p.id).filter((id): id is number => typeof id === 'number')),
  );

  /**
   * L'âge du règlement, par tranche. Miroir de l'âge de la dette client : on
   * compte depuis la date d'achat, et la dernière tranche est le seuil de
   * risque légal que l'écran Achats signale déjà.
   */
  readonly settlementAging = computed(() => {
    const buckets: Record<SettlementBucket, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    for (const purchase of this.openPurchases()) {
      const days = this.daysSince(purchase.date ?? purchase.created_at);
      if (days === null) continue;
      const key: SettlementBucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= LEGAL_RISK_DAYS ? '61-90' : '90+';
      buckets[key] += Number(purchase.outstanding_amount ?? 0);
    }

    const total = Object.values(buckets).reduce((sum, v) => sum + v, 0);
    return { buckets, total: Math.round(total * 100) / 100 };
  });

  /** Achats dus rangés par tranche — ce que la cellule cliquée sélectionne. */
  private readonly idsByBucket = computed<Record<SettlementBucket, Set<number>>>(() => {
    const out: Record<SettlementBucket, Set<number>> = {
      '0-30': new Set(), '31-60': new Set(), '61-90': new Set(), '90+': new Set(),
    };

    for (const purchase of this.openPurchases()) {
      if (typeof purchase.id !== 'number') continue;
      const days = this.daysSince(purchase.date ?? purchase.created_at);
      if (days === null) continue;
      const key: SettlementBucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= LEGAL_RISK_DAYS ? '61-90' : '90+';
      out[key].add(purchase.id);
    }

    return out;
  });

  agingShare(amount: number): number {
    const total = this.settlementAging().total;
    return total > 0 ? (amount / total) * 100 : 0;
  }

  /** Le registre après application des deux filtres. */
  readonly visibleEntries = computed<SupplierStatementEntry[]>(() => {
    const b = this.bucket();
    const ids = b ? this.idsByBucket()[b] : null;
    const due = this.dueIds();

    return this.entries().filter((entry) => {
      if (ids && !(typeof entry.purchase_id === 'number' && ids.has(entry.purchase_id))) return false;

      switch (this.scope()) {
        case 'due':
          return typeof entry.purchase_id === 'number' && due.has(entry.purchase_id);
        case 'payments':
          return entry.type === 'payment';
        case 'refunds':
          return entry.type === 'refund';
        default:
          return true;
      }
    });
  });

  readonly paymentEntryCount = computed(() => this.entries().filter((e) => e.type === 'payment').length);
  readonly refundEntryCount = computed(() => this.entries().filter((e) => e.type === 'refund').length);

  /** Une écriture rattachée à un achat encore dû : elle prend le filet rouge. */
  isDueEntry(entry: SupplierStatementEntry): boolean {
    return typeof entry.purchase_id === 'number' && this.dueIds().has(entry.purchase_id);
  }

  /** « En attente depuis 118 jours » sous la ligne d'achat. */
  waitingDays(entry: SupplierStatementEntry): number | null {
    if (!this.isDueEntry(entry) || entry.type !== 'purchase') return null;
    const days = this.daysSince(entry.date);
    return days !== null && days > 0 ? days : null;
  }

  atLegalRisk(entry: SupplierStatementEntry): boolean {
    const days = this.waitingDays(entry);
    return days !== null && days > LEGAL_RISK_DAYS;
  }

  /** Le retard le plus ancien, en badge dans la barre. */
  readonly worstWaitingDays = computed<number | null>(() => {
    let worst = 0;
    const terms = this.contractualDays();

    for (const purchase of this.openPurchases()) {
      const days = this.daysSince(purchase.date ?? purchase.created_at);
      if (days !== null && days - terms > worst) worst = days - terms;
    }

    return worst > 0 ? worst : null;
  });

  private daysSince(date: string | null | undefined): number | null {
    if (!date) return null;
    const then = new Date(date).getTime();
    if (!Number.isFinite(then)) return null;
    return Math.floor((Date.now() - then) / 86_400_000);
  }

  setScope(scope: SupplierScope): void {
    this.scope.set(scope);
  }

  /** Un second clic sur la même tranche la désélectionne. */
  toggleBucket(b: SettlementBucket): void {
    this.bucket.update((current) => (current === b ? null : b));
  }

  clearFilters(): void {
    this.scope.set('all');
    this.bucket.set(null);
  }

  readonly hasActiveFilter = computed(() => this.scope() !== 'all' || this.bucket() !== null);

  /** Refonte 2b : la modale d'édition écrite en ligne passe sur sa route. */
  openEditor(): void {
    this.router.navigate(['/suppliers', this.activeId, 'edit']);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        if (!Number.isFinite(id) || id <= 0) {
          this.loading.set(false);
          this.errorMessage.set('Fournisseur invalide.');
          return;
        }
        this.loadSupplier(id);
      });
  }

  trackById(_: number, row: { id?: number | null }): number | string {
    return row.id ?? _;
  }



  openPaymentModal(): void { this.isPaymentModalOpen.set(true); }
  closePaymentModal(): void { this.isPaymentModalOpen.set(false); }

  onPaymentSaved(): void {
    if (this.activeId) this.loadSupplier(this.activeId);
  }

  openPaymentView(payment: SupplierStatementPayment): void {
    this.viewingPaymentId.set(payment.id);
  }

  /** Depuis le registre, où l'écriture ne porte que l'identifiant du paiement. */
  openEntryPayment(entry: SupplierStatementEntry): void {
    if (typeof entry.payment_id === 'number') this.viewingPaymentId.set(entry.payment_id);
  }

  /**
   * Le relevé montre une ligne par affectation : un paiement réparti sur
   * plusieurs achats y apparaît autant de fois. On remonte donc au paiement
   * lui-même pour que la confirmation dise la vraie conséquence.
   */
  entryPayment(entry: SupplierStatementEntry): SupplierStatementPayment | null {
    if (typeof entry.payment_id !== 'number') return null;
    return (this.statement()?.payments ?? []).find((p) => p.id === entry.payment_id) ?? null;
  }

  deleteEntryPayment(entry: SupplierStatementEntry): void {
    const payment = this.entryPayment(entry);
    if (payment) this.deleteStatementPayment(payment);
  }

  closePaymentView(): void {
    this.viewingPaymentId.set(null);
  }

  deleteStatementPayment(payment: SupplierStatementPayment): void {
    const id = this.activeId;
    if (!id) return;
    this.pendingDelete.set({
      title: 'Supprimer ce paiement ?',
      consequence: payment.multi
        ? `${payment.amount} DH reviendront au dû de tous les achats que ce paiement couvrait.`
        : `${payment.amount} DH reviendront au dû de cet achat.`,
      detail: 'Le mouvement de trésorerie correspondant est supprimé avec lui.',
      run: () => this.performDeleteStatementPayment(id, payment),
    });
  }

  private performDeleteStatementPayment(id: number, payment: SupplierStatementPayment): void {
    this.deletingPaymentId.set(payment.id);
    this.supplierService.deleteSupplierPayment(id, payment.id).subscribe({
      next: () => {
        this.deletingPaymentId.set(null);
        this.loadSupplier(id);
      },
      error: () => {
        this.deletingPaymentId.set(null);
        this.actionError.set("Le paiement n'a pas pu être supprimé.");
      },
    });
  }

  deleteSupplier(): void {
    const name = this.supplier()?.name ?? 'ce fournisseur';
    const id = this.activeId;
    if (!id) return;

    this.pendingDelete.set({
      title: `Supprimer définitivement ${name} ?`,
      consequence: 'Son relevé et son historique disparaissent avec lui.',
      detail: "La suppression échouera s'il reste des achats rattachés.",
      run: () => this.performDeleteSupplier(id),
    });
  }

  private performDeleteSupplier(id: number): void {
    this.deleting.set(true);
    this.supplierService.deleteSupplier(id).subscribe({
      next: () => this.router.navigate(['/suppliers']),
      error: () => {
        this.deleting.set(false);
        alert('Impossible de supprimer ce fournisseur. Il est peut-être lié à des achats.');
      },
    });
  }

  paymentStatusClass(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PAYE') return 'badge-success';
    if (s === 'PARTIEL') return 'badge-warning';
    if (s === 'NON PAYE') return 'badge-danger';
    return 'badge-neutral';
  }

  purchaseStatusClass(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'RECU' || s === 'TERMINE') return 'badge-success';
    if (s === 'EN COURS') return 'badge-warning';
    if (s === 'ANNULE') return 'badge-danger';
    return 'badge-neutral';
  }

  private loadSupplier(id: number): void {
    this.activeId = id;
    this.loading.set(true);
    this.profileLoading.set(true);
    this.statementLoading.set(true);
    this.errorMessage.set('');
    this.statementErrorMessage.set('');
    this.profile.set(null);
    this.statement.set(null);
    this.clearFilters();

    this.supplierService.getSupplier(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: supplier => {
          if (this.activeId !== id) return;
          if (!this.profile()) {
            this.profile.set({
              supplier,
              purchases_count: 0,
              total_purchased: 0,
              last_purchase_date: null,
              outstanding_balance: 0,
              purchases: [],
            });
          }
          this.loading.set(false);
        },
        error: () => {
          if (this.activeId !== id) return;
          this.loading.set(false);
          this.profileLoading.set(false);
          this.statementLoading.set(false);
          this.errorMessage.set('Impossible de charger le profil fournisseur.');
        },
      });

    this.supplierService.getSupplierProfile(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: profile => {
          if (this.activeId !== id) return;
          this.profile.set(profile);
          this.profileLoading.set(false);
          this.loading.set(false);
        },
        error: () => {
          if (this.activeId !== id) return;
          this.profileLoading.set(false);
          if (!this.profile()?.supplier) {
            this.loading.set(false);
            this.statementLoading.set(false);
            this.errorMessage.set('Impossible de charger le profil fournisseur.');
          }
        },
      });

    this.supplierService.getSupplierStatement(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          if (this.activeId === id) {
            this.statementErrorMessage.set('Impossible de charger le relevé.');
          }
          return of(null);
        })
      )
      .subscribe(stmt => {
        if (this.activeId !== id) return;
        this.statement.set(stmt);
        this.statementLoading.set(false);
      });
  }
}
