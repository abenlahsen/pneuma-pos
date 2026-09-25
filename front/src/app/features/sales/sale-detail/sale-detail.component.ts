import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { SidePanelComponent } from '../../../shared/side-panel/side-panel.component';
import { Sale } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';
import { paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { AuthService } from '../../../core/services/auth.service';
import { ShipmentChangeService } from '../../shipment-changes/data-access/shipment-change.service';
import { ShipmentChangeListComponent } from '../../shipment-changes/components/shipment-change-list/shipment-change-list.component';
import { ShipmentChangeFormComponent } from '../../shipment-changes/components/shipment-change-form/shipment-change-form.component';
import { ShipmentChangeRequest, ShipmentChangeRequestPayload } from '../../shipment-changes/models/shipment-change.model';
import { ShipmentChangeStatus } from '../../../core/constants/status.constants';
import { isTypingTarget } from '../../../core/utils/detail-navigator';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ShipmentChangeListComponent,
    ShipmentChangeFormComponent,
    SidePanelComponent,
    IconComponent, ConfirmDeleteComponent],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.scss'
})
export class SaleDetailComponent implements OnInit, OnChanges {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  @Input({ required: true }) sale!: Sale;
  @Input() canEdit = false;
  /** Précédent / Suivant navigation, driven by the parent list page. */
  @Input() hasPrev = false;
  @Input() hasNext = false;
  /** e.g. "12 / 340" — global position in the filtered list. */
  @Input() position: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  /** Refonte 2b, 16b : l'encaissement se déclenche depuis la barre de la fiche. */
  @Output() collect = new EventEmitter<void>();

  readonly paymentMethodClass = paymentMethodClass;

  shipmentRequests = signal<ShipmentChangeRequest[]>([]);
  loadingShipmentRequests = signal(false);
  showShipmentForm = signal(false);
  editingShipmentRequest = signal<ShipmentChangeRequest | null>(null);

  constructor(
    public authService: AuthService,
    private shipmentChangeService: ShipmentChangeService,
    private router?: Router,
  ) {}

  ngOnInit(): void {
    this.loadShipmentRequests();
  }

  /**
   * The parent swaps the `sale` input in place when the user steps to the
   * previous/next record (the component instance is kept by `*ngIf`), so the
   * per-record state must be reset and the shipment requests reloaded here —
   * `ngOnInit` only runs once.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['sale'];
    if (!change || change.firstChange) return;
    this.shipmentRequests.set([]);
    this.closeShipmentForm();
    this.loadShipmentRequests();
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
    return this.showShipmentForm();
  }

  private loadShipmentRequests(): void {
    this.loadingShipmentRequests.set(true);
    this.shipmentChangeService.getForSale(this.sale.id).subscribe({
      next: (res) => {
        this.shipmentRequests.set(res.data);
        this.loadingShipmentRequests.set(false);
      },
      error: () => this.loadingShipmentRequests.set(false),
    });
  }

  openShipmentAddForm(): void {
    this.editingShipmentRequest.set(null);
    this.showShipmentForm.set(true);
  }

  openShipmentEditForm(request: ShipmentChangeRequest): void {
    this.editingShipmentRequest.set(request);
    this.showShipmentForm.set(true);
  }

  closeShipmentForm(): void {
    this.showShipmentForm.set(false);
    this.editingShipmentRequest.set(null);
  }

  onShipmentFormSubmit(payload: ShipmentChangeRequestPayload): void {
    const editing = this.editingShipmentRequest();
    const request$ = editing
      ? this.shipmentChangeService.update(editing.id, payload)
      : this.shipmentChangeService.create(this.sale.id, payload);

    request$.subscribe({
      next: () => {
        this.closeShipmentForm();
        this.loadShipmentRequests();
      },
    });
  }

  changeShipmentStatus(event: { request: ShipmentChangeRequest; status: ShipmentChangeStatus }): void {
    this.shipmentChangeService.updateStatus(event.request.id, event.status).subscribe({
      next: () => this.loadShipmentRequests(),
    });
  }

  deleteShipmentRequest(request: ShipmentChangeRequest): void {
    this.pendingDelete.set({
      title: `Supprimer la demande DM-${request.id} ?`,
      consequence: 'La demande disparaît ; la vente elle-même n\'est pas modifiée.',
      run: () => this.performDeleteShipmentRequest(request),
    });
  }

  private performDeleteShipmentRequest(request: ShipmentChangeRequest): void {
    this.shipmentChangeService.delete(request.id).subscribe({
      next: () => this.loadShipmentRequests(),
    });
  }

  /**
   * Refonte 2b, étape 10 : la facture (ou le bon de vente) s'imprime sur sa
   * propre page, `/documents/sale/:id/print`, qui relit la vente par son
   * `show` et la met en forme dans features/documents/print-builders.
   */
  openPrint(): void {
    if (!this.sale?.id) return;
    this.router?.navigate(['/documents', 'sale', this.sale.id, 'print']);
  }

  get clientName(): string {
    return this.sale?.linked_client?.name?.trim() || this.sale?.client?.trim() || '-';
  }

  get clientPhone(): string {
    return this.sale?.linked_client?.phone?.trim() || this.sale?.client_phone?.trim() || '-';
  }

  get clientCity(): string {
    return this.sale?.linked_client?.city?.trim() || this.sale?.city?.trim() || '-';
  }

  // ── Refonte 2b, gabarit 16b ───────────────────────────────────────────────

  /** Le total de la vente, quel que soit le champ qui le porte. */
  get saleTotal(): number {
    return Number(this.sale?.total_sale ?? this.sale?.total ?? 0);
  }

  get amountPaid(): number {
    return (this.sale?.payments ?? []).reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
  }

  /**
   * Ce qui reste dû. C'est le chiffre que porte l'action principale de la
   * barre — « Encaisser 48 600 DH » plutôt que « Encaisser » : on décide de
   * cliquer en sachant de combien il s'agit.
   */
  get amountDue(): number {
    return Math.max(0, Math.round((this.saleTotal - this.amountPaid) * 100) / 100);
  }

  get isSettled(): boolean {
    return this.sale?.payment_status === 'PAYE';
  }

  /** Âge de la créance, accolé au badge de paiement quand elle court encore. */
  get unpaidDays(): number | null {
    if (this.isSettled || !this.sale?.date) return null;
    const days = Math.floor((Date.now() - new Date(this.sale.date).getTime()) / 86_400_000);
    return days > 0 ? days : null;
  }

  /** Le § 6b réserve la marge à une permission dédiée. */
  get canSeeMargin(): boolean {
    return this.authService.hasPermission('view margins');
  }

  lineMargin(item: any): number {
    return this.lineTotal(item) - Number(item.purchase_price || 0) * Number(item.quantity || 0);
  }

  get outstandingBalance(): number {
    return Number(this.sale?.client_summary?.outstanding_balance ?? 0);
  }

  get creditLimit(): number {
    return Number(this.sale?.client_summary?.credit_limit ?? this.sale?.linked_client?.credit_limit ?? 0);
  }

  get showAccountWarning(): boolean {
    return !!this.sale?.client_id && !!this.sale?.client_summary;
  }

  get overCreditLimit(): boolean {
    return this.creditLimit > 0 && this.outstandingBalance > this.creditLimit;
  }

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product || item.product;
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

  lineTotal(item: any): number {
    if (item.total != null) {
      return Number(item.total);
    }

    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const unitPrice = Number(item.selling_price ?? item.unit_price ?? 0);
    return unitPrice * Number(item.quantity || 0) * (1 - discount / 100);
  }
}
