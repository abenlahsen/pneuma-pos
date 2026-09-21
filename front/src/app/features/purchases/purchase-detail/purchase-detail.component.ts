import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Purchase } from '../../../core/models/purchase.model';
import { Product } from '../../../core/models/product.model';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';
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
  imports: [CommonModule, RouterLink, DocumentPrintComponent, IconComponent, ConfirmDeleteComponent],
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

  printDoc = signal<PrintDocument | null>(null);
  returns = signal<PurchaseReturn[]>([]);
  loadingReturns = signal(false);
  readonly paymentMethodClass = paymentMethodClass;

  // Constructor injection (not inject()) so this component can still be
  // instantiated directly with plain mocks in specs, matching the rest of
  // this codebase's no-TestBed convention (see purchase-detail.component.spec.ts).
  constructor(
    private returnsService: PurchaseReturnsService,
    public authService: AuthService,
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
    this.printDoc.set(null);
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

  private hasNestedPanelOpen(): boolean {
    return !!this.printDoc();
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

  openPrint(): void {
    const lines: PrintLine[] = (this.purchase.items || []).map(item => {
      const product = this.getProduct(item);
      return {
        label: this.printLabel(product, `Produit #${item.product_id}`),
        reference: this.printReference(product),
        details: this.printDetails(product),
        qty: item.quantity,
        unit_price: Number(item.unit_price ?? 0),
        discount: 0,
        total: Number(item.unit_price ?? 0) * Number(item.quantity),
      };
    });

    this.printDoc.set({
      type: 'purchase',
      doc_number: String(this.purchase.id),
      date: this.purchase.date,
      party_label: 'Fournisseur',
      party_name: this.purchase.supplier?.name || '-',
      party_phone: this.purchase.supplier?.phone || null,
      lines,
      total_ht: Number(this.purchase.total_price ?? 0),
      discount_global: Number(this.purchase.discount ?? 0),
      net_amount: Number(this.purchase.net_amount ?? this.purchase.total_price ?? 0),
      status: this.purchase.status,
      payment_status: this.purchase.payment_status,
      commercial: this.purchase.commercial?.name || null,
    });
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product;
  }

  private printLabel(product: any, fallback: string): string {
    if (product?.type !== 'tyre') return product?.reference || fallback;
    const parts: string[] = [];
    if (product.brand?.name) parts.push(product.brand.name);
    if (product.profile) parts.push(product.profile);
    return parts.join(' ') || product?.reference || fallback;
  }

  private printReference(product: any): string | undefined {
    if (product?.type !== 'tyre') return product?.profile || undefined;
    const t = product?.tyre;
    if (t?.tire_width && t?.tire_height && t?.tire_diameter) {
      return `${t.tire_width}/${t.tire_height}R${t.tire_diameter}`;
    }
    return undefined;
  }

  private printDetails(product: any): string | undefined {
    if (product?.type !== 'tyre') return undefined;
    const t = product?.tyre;
    if (!t) return undefined;
    const parts: string[] = [];
    if (t.tire_load_index) parts.push(t.tire_load_index);
    if (t.tire_speed_index) parts.push(t.tire_speed_index);
    if (t.tire_marking) parts.push(t.tire_marking);
    return parts.length ? parts.join(' · ') : undefined;
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
