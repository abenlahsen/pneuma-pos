import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Sale, SalePayload } from '../../../core/models/sale.model';
import { SalePrestationCatalog, PrestationEntry } from '../models/sale.model';
import { SalePrestationService } from '../data-access/sale-prestation.service';
import { SALE_STATUSES, SALE_STATUS_LABELS, SALE_STATUS_TRANSITIONS, SaleStatus } from '../../../core/constants/status.constants';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { ManagedUser } from '../../../core/models/user-manage.model';
import { Carrier } from '../../carriers/models/carrier.model';
import { Partner } from '../../partners/models/partner.model';
import { Stock } from '../../../core/models/stock.model';
import { StockService } from '../../../core/services/stock.service';
import { ClientService } from '../../clients/data-access/client.service';
import { Client, ClientPayload, ClientProfileResponse } from '../../clients/models/client.model';
import { CityService } from '../../../core/services/city.service';
import { Vehicle } from '../../vehicles/models/vehicle.model';
import { VehicleSelectorComponent } from '../../../shared/vehicle-selector/vehicle-selector.component';
import { QuickClientFormComponent } from '../../../shared/quick-client-form/quick-client-form.component';
import { IconComponent } from '../../../shared/icon/icon.component';

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, ProductDetailComponent, VehicleSelectorComponent, QuickClientFormComponent],
  templateUrl: './sale-form.component.html',
  styleUrl: './sale-form.component.scss'
})
export class SaleFormComponent implements OnInit, OnDestroy {
  readonly SALE_STATUSES = SALE_STATUSES;
  readonly SALE_STATUS_LABELS = SALE_STATUS_LABELS;

  /** Current status kept first (so it stays selected) followed by the statuses it can legally move to. Only relevant in edit mode — new sales always start at EN COURS. */
  get statusOptions(): SaleStatus[] {
    const current = (this.formData.status as SaleStatus) || 'EN COURS';
    return [current, ...(SALE_STATUS_TRANSITIONS[current] || [])];
  }

  @Input() sale: Sale | null = null;
  @Input() preselectedClient: Client | null = null;
  @Input() initialCarriers: Carrier[] = [];
  @Input() initialPartners: Partner[] = [];
  @Input() initialCommercials: ManagedUser[] = [];

  @Output() save = new EventEmitter<SalePayload>();
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SalePayload>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly productService = inject(ProductService);
  private readonly stockService = inject(StockService);
  private readonly clientService = inject(ClientService);
  private readonly cityService = inject(CityService);
  private readonly prestationService = inject(SalePrestationService);

  products = signal<Product[]>([]);
  productSearch = signal('');
  loadingProducts = signal(false);
  stocks = signal<Stock[]>([]);
  loadingStocks = signal(false);
  noStockAvailable = signal(false);

  commercials = signal<ManagedUser[]>([]);
  carriers = signal<Carrier[]>([]);
  partners = signal<Partner[]>([]);
  clients = signal<Client[]>([]);
  filteredClients = signal<Client[]>([]);
  duplicateMatches = signal<Client[]>([]);
  loadingClients = signal(false);
  loadingClientProfile = signal(false);
  selectedClient = signal<Client | null>(null);
  cities = signal<string[]>([]);
  clientProfile = signal<ClientProfileResponse | null>(null);

  clientSearch = signal('');
  showClientSuggestions = signal(false);
  showQuickCreate = signal(false);
  loadingSearch = signal(false);

  private readonly clientSearchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  formData: Partial<SalePayload> = {
    date: new Date().toISOString().split('T')[0],
    with_invoice: false,
    items: [],
    total_quantity: 0,
    total_purchase: 0,
    total_sale: 0,
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    margin: 0,

    carrier_id: null,
    tracking_number: '',
    partner_id: null,
    service: '',
    client: '',
    client_phone: '',
    client_id: null,
    commercial_id: null,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    delivery_date: '',
    comments: '',
  };

  currentItem: any = {
    product_id: 0,
    stock_id: null,
    quantity: 1,
    purchase_price: 0,
    selling_price: 0,
    discount: 0,
    linkedProduct: null,
    stock: null
  };

  editingItemIndex: number | null = null;
  editingOriginalQuantity = 0;
  logisticsCollapsed = signal(true);
  vehicle_id = signal<number | null>(null);
  saleVehicleMileage = signal<number | null>(null);

  // ── Prestations (Montage + Équilibrage / Parallélisme) ──────────────────
  prestationCatalog = signal<SalePrestationCatalog | null>(null);

  montageOn = signal(false);
  montageOffert = signal(false);
  montagePrice = signal(0);
  private montagePriceTouched = signal(false);

  paralOn = signal(false);
  paralType = signal<'vt' | 'suv'>('vt');
  paralOffert = signal(false);
  paralPrice = signal(0);
  private paralPriceTouched = signal(false);

  readonly selectedClientName = computed(() =>
    this.selectedClient()?.name?.trim() || this.formData.client?.trim() || ''
  );

  readonly selectedClientPhone = computed(() =>
    this.selectedClient()?.phone?.trim() || this.formData.client_phone?.trim() || ''
  );

  readonly clientOutstandingBalance = computed(() =>
    Number(this.clientProfile()?.outstanding_balance ?? this.clientProfile()?.summary?.outstanding_balance ?? 0)
  );

  readonly clientCreditLimit = computed(() =>
    Number(
      this.clientProfile()?.client?.credit_limit
      ?? this.clientProfile()?.summary?.credit_limit
      ?? this.selectedClient()?.credit_limit
      ?? 0
    )
  );

  readonly projectedBalance = computed(() =>
    this.clientOutstandingBalance() + Number(this.formData.total_sale ?? this.formData.total ?? 0)
  );

  readonly nearCreditLimit = computed(() =>
    this.clientCreditLimit() > 0 && this.projectedBalance() >= this.clientCreditLimit() * 0.9 && this.projectedBalance() <= this.clientCreditLimit()
  );

  readonly overCreditLimit = computed(() =>
    this.clientCreditLimit() > 0 && this.projectedBalance() > this.clientCreditLimit()
  );

  /**
   * Alerte d'impaye (`2b`). Elle se declenche sur l'encours **reel** : la somme
   * des documents encore dus dans le profil charge. Pas de seuil fige — un
   * seuil ne dit rien de ce client-ci, et au comptoir c'est le montage du
   * dossier qui decide si on encaisse comptant.
   *
   * On cite le **plus ancien** document : c'est celui qui pique, pas le dernier.
   */
  readonly unpaidAlert = computed<{ amount: number; count: number; oldest: string } | null>(() => {
    const rows = this.clientProfile()?.sales_history ?? this.clientProfile()?.sales ?? [];
    const due = rows.filter((r) => Number(r.balance_due ?? 0) > 0);

    if (due.length === 0) return null;

    const oldest = [...due].sort((a, b) =>
      String(a.sale_date ?? a.created_at ?? '').localeCompare(String(b.sale_date ?? b.created_at ?? ''))
    )[0];

    return {
      amount: due.reduce((sum, r) => sum + Number(r.balance_due ?? 0), 0),
      count: due.length,
      oldest: oldest.reference || `n° ${oldest.id}`,
    };
  });

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities.set(cities));
    this.carriers.set(this.initialCarriers);
    this.partners.set(this.initialPartners);
    this.commercials.set(this.initialCommercials);

    this.setupClientSearch();
    this.loadClients();
    this.searchProducts();

    if (this.sale) {
      this.formData = { ...this.sale };
      this.formData.date = this.sale.date?.substring(0, 10) || '';
      this.formData.delivery_date = this.sale.delivery_date?.substring(0, 10) || '';
      this.formData.items = this.sale.items ? JSON.parse(JSON.stringify(this.sale.items)) : [];
      this.formData.client_id = this.sale.client_id ?? this.sale.linked_client?.id ?? null;
      this.formData.client = this.resolveClientName(this.sale);
      this.formData.client_phone = this.resolveClientPhone(this.sale);
      this.clientSearch.set(this.resolveClientName(this.sale));
      this.vehicle_id.set(this.sale.vehicle_id ?? null);
      this.saleVehicleMileage.set(this.sale.mileage ?? null);

      if (this.sale.linked_client) {
        this.selectedClient.set(this.sale.linked_client);
      }

      if (this.formData.client_id) {
        this.loadClientProfile(this.formData.client_id);
      }
    } else if (this.preselectedClient) {
      const c = this.preselectedClient;
      this.formData.client_id = c.id;
      this.formData.client = c.name ?? '';
      this.formData.client_phone = c.phone ?? '';
      this.clientSearch.set(c.name ?? '');
      this.selectedClient.set(c);
      this.loadClientProfile(c.id);
    }

    this.updateDuplicateWarnings();
    this.loadPrestationCatalog();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchProducts(): void {
    this.loadingProducts.set(true);
    const filters: Record<string, string> = { per_page: '50', is_active: '1' };

    if (this.productSearch()) {
      filters['search'] = this.productSearch();
    }

    this.productService.getProducts(filters).subscribe({
      next: (res) => {
        // Prestations (montage, parallélisme...) are added through the
        // dedicated "Prestations" panel, not the generic product picker —
        // otherwise a manually added line would conflict with the one the
        // panel manages for the same product.
        const prestationIds = this.prestationProductIds();
        this.products.set(res.data.filter(p => !prestationIds.includes(p.id)));
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSelected(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.currentItem.product_id = id;
    this.currentItem.stock_id = null;
    this.currentItem.stock = null;

    const product = this.products().find((p) => p.id === id);

    if (product) {
      this.currentItem.linkedProduct = product;

      if (product.type === 'service') {
        this.stocks.set([]);
        this.noStockAvailable.set(false);
        this.currentItem.purchase_price = 0;
        this.currentItem.selling_price = Number(product.service?.selling_price ?? 0);
      } else {
        this.loadStocksForProduct(id);
      }
    } else {
      this.currentItem.linkedProduct = null;
      this.stocks.set([]);
    }
  }

  get isCurrentService(): boolean {
    return this.currentItem.linkedProduct?.type === 'service';
  }

  get isStockOptional(): boolean {
    const type = this.currentItem.linkedProduct?.type;
    return type === 'service' || type === 'part';
  }

  loadStocksForProduct(productId: number, includeEmpty = false): void {
    this.loadingStocks.set(true);
    this.noStockAvailable.set(false);
    const filters: Record<string, string> = { product_id: String(productId), per_page: '100' };

    if (!includeEmpty) {
      filters['in_stock'] = '1';
    }

    this.stockService.getStocks(filters).subscribe({
      next: (res) => {
        let list = res.data;
        const currentStock = this.currentItem.stock;
        const currentStockId = this.currentItem.stock_id;

        if (currentStockId && !list.find((s) => s.id === currentStockId) && currentStock) {
          list = [currentStock, ...list];
        }

        this.stocks.set(list);
        this.noStockAvailable.set(list.length === 0);
        this.loadingStocks.set(false);

        if (list.length > 0 && !this.currentItem.stock_id) {
          this.currentItem.stock_id = list[0].id;
          this.onStockSelected();
        }
      },
      error: () => this.loadingStocks.set(false),
    });
  }

  onStockSelected(): void {
    const stock = this.selectedStock;

    if (stock) {
      this.currentItem.stock = stock;
      if (stock.purchase_price != null) {
        this.currentItem.purchase_price = Number(stock.purchase_price);
      }
    }
  }

  get selectedStock(): Stock | null {
    if (!this.currentItem.stock_id) return null;
    return this.stocks().find((s) => s.id === this.currentItem.stock_id) || null;
  }

  get stockInsufficient(): boolean {
    const stock = this.selectedStock;
    if (!stock) return false;

    let available = stock.quantity;
    if (this.editingItemIndex !== null) {
      const original: any = this.sale?.items?.[this.editingItemIndex];
      if (original && original.stock_id === stock.id) {
        available += Number(this.editingOriginalQuantity) || 0;
      }
    }

    return (this.currentItem.quantity || 0) > available;
  }

  addItem(): void {
    if (!this.currentItem.product_id) return;

    const stockOptional = this.isStockOptional;
    if (!stockOptional && !this.currentItem.stock_id) return;

    if (this.currentItem.stock_id && this.stockInsufficient) {
      alert('Quantité insuffisante en stock.');
      return;
    }

    if (this.editingItemIndex !== null) {
      this.formData.items![this.editingItemIndex] = { ...this.currentItem };
    } else {
      this.formData.items!.push({ ...this.currentItem });
    }

    // A tyre line's quantity may have just changed — keep the montage
    // line (sized to tyreQuantity()) in sync.
    this.syncPrestationLines();
    this.resetCurrentItem();
  }

  editItem(index: number): void {
    const item: any = this.formData.items![index];
    const product = item.linkedProduct || item.linked_product || item.product || null;
    this.editingOriginalQuantity = Number(item.quantity) || 0;

    this.currentItem = {
      product_id: item.product_id || product?.id || 0,
      stock_id: item.stock_id ?? null,
      quantity: item.quantity || 1,
      purchase_price: item.purchase_price ?? 0,
      selling_price: item.selling_price ?? item.unit_price ?? 0,
      discount: Number(item.discount ?? 0),
      linkedProduct: product,
      stock: item.stock || null
    };

    if (product && !this.products().find((p) => p.id === product.id)) {
      this.products.set([product, ...this.products()]);
    }

    if (product && product.type !== 'service' && this.currentItem.product_id) {
      this.loadStocksForProduct(this.currentItem.product_id, true);
    } else {
      this.stocks.set([]);
    }

    this.editingItemIndex = index;
  }

  cancelItemEdit(): void {
    this.resetCurrentItem();
  }

  removeItem(index: number): void {
    const item: any = this.formData.items![index];

    // A prestation line is owned by the "Prestations" panel — removing it
    // here just unchecks its box, which re-derives the items list.
    if (this.isPrestationLine(item)) {
      this.uncheckPrestationForProduct(item.product_id);
      return;
    }

    if (this.editingItemIndex === index) {
      this.resetCurrentItem();
    } else if (this.editingItemIndex !== null && this.editingItemIndex > index) {
      this.editingItemIndex--;
    }

    this.formData.items!.splice(index, 1);
    this.syncPrestationLines();
  }

  formatStockLabel(s: Stock): string {
    const parts: string[] = [];
    if (s.depot) parts.push(s.depot);
    if (s.zone) parts.push(s.zone);
    if (s.dot) parts.push('DOT ' + s.dot);
    parts.push('Qté: ' + s.quantity);
    return parts.join(' — ');
  }

  formatProductLabel(p: Product): string {
    const typeTag = p.type === 'tyre' ? '[Pneu]' : p.type === 'part' ? '[Pièce]' : '[Service]';
    const brand = p.brand?.name || '';
    const ref = p.reference || '';
    const profile = p.profile || '';
    let detail = '';

    if (p.type === 'tyre' && p.tyre?.tire_width) {
      detail = `${p.tyre.tire_width}/${p.tyre.tire_height}R${p.tyre.tire_diameter}`;
    } else if (p.type === 'part' && p.part?.category) {
      detail = p.part.category;
    } else if (p.type === 'service' && p.service?.category) {
      detail = p.service.category;
    }

    return [typeTag, ref, brand, detail, profile].filter(Boolean).join(' — ');
  }

  /**
   * Nom d'article tel qu'on le prononce au comptoir : la marque, la dimension,
   * le profil. La reference n'est pas un nom — elle part sur la ligne du
   * dessous (`2b`), ou elle sert a verifier sans encombrer la lecture.
   */
  productName(p: Product | null | undefined): string {
    if (!p) return '';

    // Une prestation n'a ni marque ni dimension : son nom est son libelle de
    // catalogue, le seul mot qu'on emploie pour elle au comptoir.
    const prestation = this.prestationLabelFor(p.id);
    if (prestation) return prestation;

    return [p.brand?.name, this.productDetail(p), p.profile].filter(Boolean).join(' ')
      || `Article #${p.id}`;
  }

  /** Libelle catalogue d'une prestation, ou null si le produit n'en est pas une. */
  private prestationLabelFor(productId: number | null | undefined): string | null {
    const cat = this.prestationCatalog();
    if (!cat || productId == null) return null;

    for (const entry of [cat.montage, cat.alignment_vt, cat.alignment_suv]) {
      if (entry?.product_id === productId) return entry.label;
    }

    return null;
  }

  /** Deuxieme ligne de la cellule : le type, puis la reference. */
  productRef(p: Product | null | undefined): string {
    if (!p) return '';

    const type = p.type === 'tyre' ? 'Pneu' : p.type === 'part' ? 'Pièce' : 'Service';

    return [type, p.reference].filter(Boolean).join(' · ');
  }

  /** Ce qui distingue deux articles de la meme marque : dimension ou categorie. */
  private productDetail(p: Product): string {
    if (p.type === 'tyre' && p.tyre?.tire_width) {
      return `${p.tyre.tire_width}/${p.tyre.tire_height}R${p.tyre.tire_diameter}`;
    }

    if (p.type === 'part') return p.part?.category ?? '';

    return p.service?.category ?? '';
  }

  viewingProduct = signal<any>(null);

  getProduct(item: any): any {
    return item.linkedProduct || item.linked_product || item.product;
  }

  openProductView(item: any): void {
    const product = this.getProduct(item);
    if (product) {
      this.viewingProduct.set(product);
    }
  }

  editProductInNewTab(product: any): void {
    this.viewingProduct.set(null);
    window.open(`/products?id=${product.id}&edit=1`, '_blank', 'noopener');
  }

  lineTotal(item: any): number {
    const qte = Number(item.quantity || 1);
    const sell = Number(item.selling_price ?? item.unit_price ?? 0);
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    return sell * qte * (1 - discount / 100);
  }

  calculateTotals(): void {
    let totalPurchase = 0;
    let totalSale = 0;
    let totalQuantity = 0;

    for (const item of this.formData.items || []) {
      totalPurchase += Number(item.purchase_price || 0) * Number(item.quantity || 1);
      totalSale += this.lineTotal(item);
      // A prestation (montage, parallélisme...) rides on a tyre line's
      // quantity but isn't itself an "article" — exclude it so "Total
      // Articles" reflects units sold, not lines billed. Mirrors
      // SaleService::calculateTotals() on the backend.
      if (this.getProduct(item)?.type !== 'service') {
        totalQuantity += Number(item.quantity || 0);
      }
      item.total = this.lineTotal(item);
      item.total_sale = this.lineTotal(item);
      item.unit_price = Number(item.selling_price ?? item.unit_price ?? 0);
    }

    this.formData.total_quantity = totalQuantity;
    this.formData.total_purchase = totalPurchase;
    this.formData.total_sale = totalSale;
    this.formData.subtotal = totalSale;
    this.formData.total = totalSale - Number(this.formData.discount || 0) + Number(this.formData.tax || 0);
    this.formData.margin = totalSale - totalPurchase;
  }

  // ── Prestations (Montage + Équilibrage / Parallélisme) ──────────────────

  private loadPrestationCatalog(): void {
    this.prestationService.getCatalog().subscribe({
      next: catalog => {
        this.prestationCatalog.set(catalog);
        this.hydratePrestationsFromItems();
        this.syncPrestationLines();
      },
      // A 403/network failure must not leave the panel ambiguously stuck:
      // an explicit all-null catalog makes every isXAvailable() check false,
      // same as "not configured", instead of retrying forever.
      error: () => this.prestationCatalog.set({ montage: null, alignment_vt: null, alignment_suv: null }),
    });
  }

  /** Number of tyre units on the sale — the montage line is sized to this. */
  tyreQuantity(): number {
    return (this.formData.items || [])
      .filter(item => this.getProduct(item)?.type === 'tyre')
      .reduce((sum, item: any) => sum + Number(item.quantity || 0), 0);
  }

  private prestationProductIds(): number[] {
    const cat = this.prestationCatalog();
    if (!cat) return [];
    return [cat.montage?.product_id, cat.alignment_vt?.product_id, cat.alignment_suv?.product_id]
      .filter((id): id is number => id != null);
  }

  isPrestationLine(item: any): boolean {
    return this.prestationProductIds().includes(item?.product_id);
  }

  private currentParalEntry(): PrestationEntry | null {
    const cat = this.prestationCatalog();
    if (!cat) return null;
    return this.paralType() === 'suv' ? cat.alignment_suv : cat.alignment_vt;
  }

  /** Whether the montage catalog product has been seeded — gates the checkbox. */
  isMontageAvailable(): boolean {
    return !!this.prestationCatalog()?.montage;
  }

  /** Whether at least one parallélisme variant (VT or SUV) has been seeded. */
  isParalAvailable(): boolean {
    const cat = this.prestationCatalog();
    return !!(cat?.alignment_vt || cat?.alignment_suv);
  }

  isParalTypeAvailable(type: 'vt' | 'suv'): boolean {
    const cat = this.prestationCatalog();
    return !!(type === 'suv' ? cat?.alignment_suv : cat?.alignment_vt);
  }

  onPartnerChange(partnerId: number | null): void {
    this.formData.partner_id = partnerId;
    this.applyPartnerPricing();
  }

  onMontageToggle(checked: boolean): void {
    // Refuse to turn on a prestation whose catalog product isn't seeded —
    // otherwise the inline calculator shows a price for a line that
    // syncPrestationLines() would silently never add.
    if (checked && !this.isMontageAvailable()) return;
    this.montageOn.set(checked);
    this.applyPartnerPricing();
  }

  onMontagePriceChange(value: number): void {
    this.montagePriceTouched.set(true);
    this.montagePrice.set(Number(value) || 0);
    this.syncPrestationLines();
  }

  onMontageOffertToggle(checked: boolean): void {
    this.montageOffert.set(checked);
    this.syncPrestationLines();
  }

  onParalToggle(checked: boolean): void {
    if (checked) {
      if (!this.isParalAvailable()) return;
      // The current type might not be the one that's actually seeded —
      // switch to whichever is, rather than turning on with nothing to add.
      if (!this.isParalTypeAvailable(this.paralType())) {
        this.paralType.set(this.isParalTypeAvailable('vt') ? 'vt' : 'suv');
      }
    }
    this.paralOn.set(checked);
    this.applyPartnerPricing();
  }

  onParalTypeChange(type: 'vt' | 'suv'): void {
    if (!this.isParalTypeAvailable(type)) return;
    this.paralType.set(type);
    this.applyPartnerPricing();
  }

  onParalPriceChange(value: number): void {
    this.paralPriceTouched.set(true);
    this.paralPrice.set(Number(value) || 0);
    this.syncPrestationLines();
  }

  onParalOffertToggle(checked: boolean): void {
    this.paralOffert.set(checked);
    this.syncPrestationLines();
  }

  /**
   * Pre-fills montage/parallélisme prices from the selected partner's rates
   * (partners.montage_price / alignment_price / alignment_price_suv), unless
   * the seller has already typed a price in by hand for this sale.
   */
  private applyPartnerPricing(): void {
    const partner = this.partners().find(p => p.id === this.formData.partner_id);

    if (partner) {
      if (!this.montagePriceTouched() && partner.montage_price != null) {
        this.montagePrice.set(Number(partner.montage_price));
      }

      if (!this.paralPriceTouched()) {
        const price = this.paralType() === 'suv' ? partner.alignment_price_suv : partner.alignment_price;
        if (price != null) {
          this.paralPrice.set(Number(price));
        }
      }
    }

    this.syncPrestationLines();
  }

  private buildPrestationLine(entry: PrestationEntry, quantity: number, price: number, offert: boolean): any {
    return {
      product_id: entry.product_id,
      stock_id: null,
      quantity,
      purchase_price: 0,
      selling_price: price,
      discount: offert ? 100 : 0,
      // La vraie reference, pas le libelle : une ligne ajoutee a l'instant doit
      // se lire exactement comme la meme ligne relue depuis le serveur.
      linkedProduct: { id: entry.product_id, type: 'service', reference: entry.reference ?? '', profile: '' },
      stock: null,
    };
  }

  /** Uncheck whichever prestation owns this product (used by removeItem()). */
  private uncheckPrestationForProduct(productId: number): void {
    const cat = this.prestationCatalog();
    if (!cat) return;

    if (productId === cat.montage?.product_id) {
      this.montageOn.set(false);
    } else if (productId === cat.alignment_vt?.product_id || productId === cat.alignment_suv?.product_id) {
      this.paralOn.set(false);
    }

    this.syncPrestationLines();
  }

  /**
   * Rebuilds the sale's prestation lines from the current checkbox/price
   * state: strips any existing montage/parallélisme lines, then re-adds
   * the active ones. Called after every prestation toggle, price/type/
   * offert change, and whenever a normal line is added/removed/edited
   * (the tyre quantity the montage line is sized to may have changed).
   */
  private syncPrestationLines(): void {
    const cat = this.prestationCatalog();
    const prestationIds = this.prestationProductIds();

    this.formData.items = (this.formData.items || []).filter((item: any) => !prestationIds.includes(item.product_id));

    if (cat?.montage && this.montageOn()) {
      const qty = this.tyreQuantity();
      if (qty > 0) {
        this.formData.items!.push(this.buildPrestationLine(cat.montage, qty, this.montagePrice(), this.montageOffert()));
      }
    }

    if (this.paralOn()) {
      const entry = this.currentParalEntry();
      if (entry) {
        this.formData.items!.push(this.buildPrestationLine(entry, 1, this.paralPrice(), this.paralOffert()));
      }
    }

    this.calculateTotals();
  }

  /** On edit: reflect an existing sale's prestation lines back into the panel's checkboxes/prices. */
  private hydratePrestationsFromItems(): void {
    const cat = this.prestationCatalog();
    if (!cat) return;

    const items = this.formData.items || [];

    if (cat.montage) {
      const line: any = items.find((i: any) => i.product_id === cat.montage!.product_id);
      if (line) {
        this.montageOn.set(true);
        this.montagePrice.set(Number(line.selling_price ?? line.unit_price ?? 0));
        this.montagePriceTouched.set(true);
        this.montageOffert.set(Number(line.discount ?? 0) >= 100);
      }
    }

    const vtLine: any = cat.alignment_vt ? items.find((i: any) => i.product_id === cat.alignment_vt!.product_id) : null;
    const suvLine: any = cat.alignment_suv ? items.find((i: any) => i.product_id === cat.alignment_suv!.product_id) : null;
    const paralLine = vtLine || suvLine;

    if (paralLine) {
      this.paralOn.set(true);
      this.paralType.set(suvLine ? 'suv' : 'vt');
      this.paralPrice.set(Number(paralLine.selling_price ?? paralLine.unit_price ?? 0));
      this.paralPriceTouched.set(true);
      this.paralOffert.set(Number(paralLine.discount ?? 0) >= 100);
    }
  }

  onClientSearchInput(value: string): void {
    this.clientSearch.set(value);
    this.showClientSuggestions.set(true);
    this.clientSearchSubject.next(value);
    this.updateDuplicateWarnings();
  }

  onVehicleSelected(vehicle: Vehicle | null): void {
    this.vehicle_id.set(vehicle?.id ?? null);
  }

  selectClient(client: Client): void {
    this.selectedClient.set(client);
    this.formData.client_id = client.id;
    this.formData.client = client.name || '';
    this.formData.client_phone = client.phone || '';
    this.clientSearch.set(client.name || '');
    this.showClientSuggestions.set(false);
    this.showQuickCreate.set(false);
    this.vehicle_id.set(null);
    this.saleVehicleMileage.set(null);
    this.updateDuplicateWarnings();

    if (client.id) {
      this.loadClientProfile(client.id);
    } else {
      this.clientProfile.set(null);
    }
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.clientProfile.set(null);
    this.formData.client_id = null;
    this.clientSearch.set(this.formData.client || '');
    this.showClientSuggestions.set(false);
    this.vehicle_id.set(null);
    this.saleVehicleMileage.set(null);
    this.updateDuplicateWarnings();
  }

  onManualClientChange(): void {
    const selected = this.selectedClient();
    if (selected && this.hasManualClientChanged(selected)) {
      this.selectedClient.set(null);
      this.clientProfile.set(null);
      this.formData.client_id = null;
    }

    this.clientSearch.set(this.formData.client || '');
    this.clientSearchSubject.next(this.clientSearch());
    this.updateDuplicateWarnings();
  }

  openQuickCreate(): void {
    this.showQuickCreate.set(true);
    this.showClientSuggestions.set(false);
  }

  onQuickClientCreated(client: Client): void {
    this.clients.update(list => [client, ...list.filter(c => c.id !== client.id)]);
    this.selectClient(client);
    this.showQuickCreate.set(false);
  }

  /**
   * Enregistre la saisie en brouillon : la vente existe, mais elle n'entre pas
   * dans le flux — elle ne bouge pas le stock et ne compte dans aucun chiffre
   * tant qu'on ne la valide pas.
   */
  saveDraft(): void {
    this.formData.status = 'BROUILLON';
    this.onSubmit();
  }

  onSubmit(): void {
    if (!this.formData.commercial_id) {
      alert('Veuillez sélectionner un commercial.');
      return;
    }
    if (!this.formData.partner_id) {
      alert('Veuillez sélectionner un partenaire.');
      return;
    }
    if (!this.formData.items || this.formData.items.length === 0) {
      alert('Veuillez ajouter au moins un produit.');
      return;
    }

    this.calculateTotals();

    const payload = this.buildPayload();
    this.save.emit(payload);
    this.saved.emit(payload);
  }

  private buildPayload(): SalePayload {
    return {
      ...(this.formData as SalePayload),
      client: (this.formData.client || '').trim(),
      client_phone: (this.formData.client_phone || '').trim(),
      client_id: this.formData.client_id ?? null,
      vehicle_id: this.vehicle_id(),
      mileage: this.saleVehicleMileage(),
      items: (this.formData.items || []).map((item: any) => ({
        ...item,
        unit_price: Number(item.selling_price ?? item.unit_price ?? 0),
        total: this.lineTotal(item),
        total_sale: this.lineTotal(item),
      })),
    };
  }

  private setupClientSearch(): void {
    this.clientSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        const trimmed = term.trim();
        if (!trimmed) {
          return of(this.clients().slice(0, 8));
        }
        this.loadingSearch.set(true);
        return this.clientService.getClients({ search: trimmed, per_page: 20, status: 'active' }).pipe(
          finalize(() => this.loadingSearch.set(false)),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(clients => {
      this.filteredClients.set(clients.slice(0, 8));
    });
  }

  private loadClients(): void {
    this.loadingClients.set(true);

    this.clientService.getClients({ per_page: 20, status: 'active' }).pipe(
      finalize(() => this.loadingClients.set(false))
    ).subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.filteredClients.set(clients.slice(0, 8));

        if (this.formData.client_id) {
          const selected = clients.find((client) => client.id === this.formData.client_id);
          if (selected) {
            this.selectedClient.set(selected);
          } else {
            this.loadClientById(this.formData.client_id);
          }
        }

        this.updateDuplicateWarnings();
      },
      error: () => {
        this.clients.set([]);
        this.filteredClients.set([]);
      }
    });
  }

  private loadClientById(clientId: number): void {
    this.clientService.getClient(clientId).subscribe({
      next: (client) => this.selectedClient.set(client),
    });
  }

  private loadClientProfile(clientId: number): void {
    this.loadingClientProfile.set(true);

    this.clientService.getClientProfile(clientId).pipe(
      finalize(() => this.loadingClientProfile.set(false))
    ).subscribe({
      next: (profile) => this.clientProfile.set(profile),
      error: () => this.clientProfile.set(null),
    });
  }


  updateDuplicateWarnings(): void {
    const selectedId = this.selectedClient()?.id;
    const name = (this.formData.client || this.clientSearch()).trim().toLowerCase();
    const phone = (this.formData.client_phone || '').trim().toLowerCase();

    this.duplicateMatches.set(
      this.clients().filter((client) => {
        if (selectedId && client.id === selectedId) {
          return false;
        }

        const sameName = !!name && client.name?.trim().toLowerCase() === name;
        const samePhone = !!phone && client.phone?.trim().toLowerCase() === phone;

        return sameName || samePhone;
      })
    );
  }


  private hasManualClientChanged(selected: Client): boolean {
    return (this.formData.client || '').trim() !== (selected.name || '').trim()
      || (this.formData.client_phone || '').trim() !== (selected.phone || '').trim()
      ;
  }

  private resolveClientName(sale: Sale): string {
    return sale.linked_client?.name || sale.client || '';
  }

  private resolveClientPhone(sale: Sale): string {
    return sale.linked_client?.phone || sale.client_phone || '';
  }

  private resetCurrentItem(): void {
    this.currentItem = {
      product_id: 0,
      stock_id: null,
      quantity: 1,
      purchase_price: 0,
      selling_price: 0,
      discount: 0,
      linkedProduct: null,
      stock: null
    };
    this.editingItemIndex = null;
    this.editingOriginalQuantity = 0;
    this.productSearch.set('');
    this.products.set([]);
    this.stocks.set([]);
    this.searchProducts();
  }
}