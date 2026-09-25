import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Purchase } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { AuthService } from '../../../core/services/auth.service';
// Return-related calls live only on this (features/purchases) copy of PurchaseService —
// the core/services copy this component otherwise has no need for is not extended with them.
import { PurchaseService as PurchaseReturnsService } from '../data-access/purchase.service';
import { PurchaseReturn } from '../models/purchase.model';
import { isTypingTarget } from '../../../core/utils/detail-navigator';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';

@Component({
  selector: 'app-purchase-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, ConfirmDeleteComponent],
  templateUrl: './purchase-detail.component.html',
  styleUrls: ['../../sales/sale-detail/sale-detail.component.scss', './purchase-detail.component.scss']
})
export class PurchaseDetailComponent implements OnInit, OnChanges {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  @Input({ required: true }) purchase!: Purchase;
  @Input() canEdit = false;
  @Input() canReturn = false;
  /** Précédent / Suivant navigation, driven by the parent list page. */
  @Input() hasPrev = false;
  @Input() hasNext = false;
  /** e.g. "12 / 340" — global position in the filtered list. */
  @Input() position: string | null = null;
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() openReturn = new EventEmitter<void>();
  /** Refonte 2b, 16b : le règlement se déclenche depuis la barre. */
  @Output() settle = new EventEmitter<void>();
  /** Emitted after a return is deleted here — the parent's purchase list and this
   *  modal's own (now stale) status/payment_status/returned_amount need a refresh. */
  @Output() returnsChanged = new EventEmitter<void>();

  /** Échec d'une action : la fiche reste affichée. */
  readonly actionError = signal('');

  returns = signal<PurchaseReturn[]>([]);
  loadingReturns = signal(false);
  readonly paymentMethodClass = paymentMethodClass;

  // Constructor injection (not inject()) so this component can still be
  // instantiated directly with plain mocks in specs, matching the rest of
  // this codebase's no-TestBed convention (see purchase-detail.component.spec.ts).
  constructor(
    private returnsService: PurchaseReturnsService,
    public authService: AuthService,
    private router?: Router,
  ) {}

  ngOnInit(): void {
    this.loadReturns();
  }

  /**
   * The parent swaps the `purchase` input in place when the user steps to the
   * previous/next record (the component instance is kept by `*ngIf`), so the
   * per-record state must be reset and the returns reloaded here — `ngOnInit`
   * only runs once.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['purchase'];
    if (!change || change.firstChange) return;
    this.returns.set([]);
    this.loadReturns();
  }

  /** ← / → step through the list, unless the user is typing or a nested panel is open. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (isTypingTarget(event.target) || this.hasNestedPanelOpen()) return;

    if (event.key === 'ArrowLeft' && this.hasPrev) {
      event.preventDefault();
      this.prev.emit();
    } else if (event.key === 'ArrowRight' && this.hasNext) {
      event.preventDefault();
      this.next.emit();
    }
  }

  /**
   * Plus aucun panneau imbriqué : l'aperçu d'impression, seul candidat, est
   * devenu une page. Gardé pour que ← / → aient un point d'arrêt si un volet
   * revient.
   */
  private hasNestedPanelOpen(): boolean {
    return false;
  }

  // ── Refonte 2b, gabarit 16b ───────────────────────────────────────────────

  get purchaseTotal(): number {
    return Number(this.purchase?.net_amount ?? this.purchase?.total_price ?? 0);
  }

  get amountPaid(): number {
    return (this.purchase?.payments ?? []).reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
  }

  /** Ce qui reste à régler — le chiffre que porte l'action principale. */
  get amountDue(): number {
    return Math.max(0, Math.round((this.purchaseTotal - this.amountPaid) * 100) / 100);
  }

  get isSettled(): boolean {
    return this.purchase?.payment_status === 'PAYE';
  }

  /** Le délai que le fournisseur accorde, quand sa fiche le renseigne. */
  get contractualDays(): number | null {
    const days = (this.purchase?.supplier as any)?.payment_terms_days;
    return typeof days === 'number' ? days : null;
  }

  /** Âge du règlement : depuis combien de jours cet achat attend d'être payé. */
  get settlementAgeDays(): number | null {
    if (this.isSettled || !this.purchase?.date) return null;
    const days = Math.floor((Date.now() - new Date(this.purchase.date).getTime()) / 86_400_000);
    return days > 0 ? days : null;
  }

  /**
   * Le dépassement du délai fournisseur, s'il y en a un. C'est ce que la
   * colonne de droite montre à la place de la marge : sur un achat, la
   * question n'est pas ce qu'on gagne mais depuis quand on doit.
   */
  get daysOverTerms(): number | null {
    const age = this.settlementAgeDays;
    const terms = this.contractualDays;
    if (age === null || terms === null) return null;
    return age - terms > 0 ? age - terms : null;
  }

  get returnedAmount(): number {
    return this.returns().reduce((sum, r: any) => sum + Number(r.total_amount ?? 0), 0);
  }

  loadReturns(): void {
    this.loadingReturns.set(true);
    this.returnsService.getReturns(this.purchase.id).subscribe({
      next: (data) => {
        this.returns.set(data);
        this.loadingReturns.set(false);
      },
      error: () => this.loadingReturns.set(false),
    });
  }

  deleteReturn(purchaseReturn: PurchaseReturn): void {
    this.pendingDelete.set({
      title: `Supprimer le retour ${purchaseReturn.id} ?`,
      consequence: `${purchaseReturn.total_quantity} article(s) reviendront en stock et ${purchaseReturn.total_amount} DH au dû de l'achat.`,
      run: () => this.performDeleteReturn(purchaseReturn),
    });
  }

  private performDeleteReturn(purchaseReturn: PurchaseReturn): void {
    this.returnsService.deleteReturn(purchaseReturn.id).subscribe({
      next: () => {
        this.loadReturns();
        this.returnsChanged.emit();
      },
      error: () => this.actionError.set("Le retour n'a pas pu être supprimé."),
    });
  }

  /**
   * Refonte 2b, étape 10 : le bon d'achat s'imprime sur sa propre page,
   * `/documents/purchase/:id/print`, qui relit l'achat par son `show` et le
   * met en forme dans features/documents/print-builders (buildPurchasePrint) :
   * adresse du fournisseur, modes de paiement, déjà payé et reste dû.
   */
  openPrint(): void {
    if (!this.purchase?.id) return;
    this.router?.navigate(['/documents', 'purchase', this.purchase.id, 'print']);
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  /**
   * Refonte 2b, 6c : product-detail est supprimé. Il répétait en lecture seule
   * ce que l'éditeur 15a montre déjà. On ouvre donc l'éditeur, dans un nouvel
   * onglet pour ne pas perdre la saisie ou la fiche en cours.
   */
  openProductView(item: any): void {
    const product = this.getProduct(item);
    if (product?.id) {
      window.open(`/products/${product.id}/edit`, '_blank', 'noopener');
    }
  }

}
