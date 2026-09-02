import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sale } from '../../../core/models/sale.model';
import { Product } from '../../../core/models/product.model';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { DocumentPrintComponent, PrintDocument, PrintLine } from '../../../shared/document-print/document-print.component';
import { paymentMethodClass } from '../../../core/constants/payment-method.constants';
import { AuthService } from '../../../core/services/auth.service';
import { ShipmentChangeService } from '../../shipment-changes/data-access/shipment-change.service';
import { ShipmentChangeListComponent } from '../../shipment-changes/components/shipment-change-list/shipment-change-list.component';
import { ShipmentChangeFormComponent } from '../../shipment-changes/components/shipment-change-form/shipment-change-form.component';
import { ShipmentChangePrintComponent } from '../../shipment-changes/components/shipment-change-print/shipment-change-print.component';
import { ShipmentChangeRequest, ShipmentChangeRequestPayload } from '../../shipment-changes/models/shipment-change.model';
import { ShipmentChangeStatus } from '../../../core/constants/status.constants';
import { isTypingTarget } from '../../../core/utils/detail-navigator';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [
    CommonModule,
    ProductDetailComponent,
    DocumentPrintComponent,
    ShipmentChangeListComponent,
    ShipmentChangeFormComponent,
    ShipmentChangePrintComponent,
  ],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.scss'
})
export class SaleDetailComponent implements OnInit, OnChanges {
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

  viewingProduct = signal<Product | null>(null);
  printDoc = signal<PrintDocument | null>(null);
  readonly paymentMethodClass = paymentMethodClass;

  shipmentRequests = signal<ShipmentChangeRequest[]>([]);
  loadingShipmentRequests = signal(false);
  showShipmentForm = signal(false);
  editingShipmentRequest = signal<ShipmentChangeRequest | null>(null);
  shipmentPrintDoc = signal<ShipmentChangeRequest | null>(null);

  constructor(
    public authService: AuthService,
    private shipmentChangeService: ShipmentChangeService,
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
    this.viewingProduct.set(null);
    this.printDoc.set(null);
    this.shipmentRequests.set([]);
    this.closeShipmentForm();
    this.shipmentPrintDoc.set(null);
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
    return !!this.viewingProduct() || !!this.printDoc() || this.showShipmentForm() || !!this.shipmentPrintDoc();
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

  openShipmentPrint(request: ShipmentChangeRequest): void {
    this.shipmentPrintDoc.set(request);
  }

  changeShipmentStatus(event: { request: ShipmentChangeRequest; status: ShipmentChangeStatus }): void {
    this.shipmentChangeService.updateStatus(event.request.id, event.status).subscribe({
      next: () => this.loadShipmentRequests(),
    });
  }

  deleteShipmentRequest(request: ShipmentChangeRequest): void {
    if (!confirm(`Supprimer la demande de modification DM-${request.id} ?`)) return;

    this.shipmentChangeService.delete(request.id).subscribe({
      next: () => this.loadShipmentRequests(),
    });
  }

  openPrint(): void {
    const lines: PrintLine[] = (this.sale.items || []).map(item => {
      const product = this.getProduct(item);
      return {
        label: this.printLabel(product, item.product_name || `Produit #${item.product_id}`),
        reference: this.printReference(product),
        details: this.printDetails(product),
        qty: item.quantity,
        unit_price: Number(item.selling_price ?? item.unit_price ?? 0),
        discount: Number(item.discount || 0),
        total: this.lineTotal(item),
      };
    });

    this.printDoc.set({
      type: 'sale',
      doc_number: String(this.sale.id),
      date: this.sale.date,
      party_label: 'Client',
      party_name: this.clientName,
      party_phone: this.clientPhone,
      party_city: this.clientCity,
      lines,
      total_ht: Number(this.sale.total_sale ?? this.sale.total ?? 0),
      net_amount: Number(this.sale.total_sale ?? this.sale.total ?? 0),
      status: this.sale.status,
      payment_status: this.sale.payment_status,
      notes: this.sale.comments || null,
      commercial: this.sale.commercial?.name || null,
      carrier: this.sale.carrier?.name || null,
      tracking_number: this.sale.tracking_number || null,
      partner: this.sale.partner?.name || null,
      service: this.sale.service || null,
      delivery_date: this.sale.delivery_date || null,
      payment_method: this.sale.payment_methods?.length ? this.sale.payment_methods.join(', ') : null,
    });
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

  openProductView(item: any): void {
    const product = this.getProduct(item);
    if (product) {
      this.viewingProduct.set(product);
    }
  }

  editProductInNewTab(product: Product): void {
    this.viewingProduct.set(null);
    window.open(`/products?id=${product.id}&edit=1`, '_blank', 'noopener');
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

  lineTotal(item: any): number {
    if (item.total != null) {
      return Number(item.total);
    }

    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const unitPrice = Number(item.selling_price ?? item.unit_price ?? 0);
    return unitPrice * Number(item.quantity || 0) * (1 - discount / 100);
  }
}
