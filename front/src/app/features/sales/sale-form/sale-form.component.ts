import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ProductDetailComponent } from '../../products/product-detail/product-detail.component';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Sale, SalePayload } from '../../../core/models/sale.model';
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

/**
 * Refonte 2b, étape 4 — écran plein deux volets (design_handoff_refonte_2b/
 * Refonte Nouvelle vente.dc.html), remplace la modale à cinq sections.
 *
 * Changement de fond par rapport à l'ancienne version : on ne choisit plus
 * un produit puis un lot de stock dans deux `<select>` séparés, puis on
 * "ajoute" une ligne mise en forme dans une zone de saisie à part — on
 * cherche directement des LOTS DE STOCK (catalogue à gauche, recherche par
 * dimension "2055516" ou texte), et cliquer une ligne l'ajoute tout de suite
 * au ticket (à droite). Qté, PU vente et remise se modifient ensuite en
 * place sur la ligne du ticket — il n'y a donc plus de `currentItem` ni de
 * mode "édition" séparé : `editItem`/`addItem`/`onProductSelected` etc. ont
 * disparu, remplacés par des mutations directes sur `formData.items[i]`.
 */
@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductDetailComponent, VehicleSelectorComponent, QuickClientFormComponent, IconComponent],
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
  // Lus directement dans le template (initialCarriers()/... non repris dans
  // un signal local) : ce composant n'est pas OnPush, donc ces @Input()
  // ordinaires restent à jour à chaque passage de détection de changement.
  // Les copier une fois dans un signal à ngOnInit() les figeait au moment du
  // montage — sale-form-page.component charge ces listes de manière
  // asynchrone, et elles arrivaient presque toujours après ce montage.
  @Input() initialCarriers: Carrier[] = [];
  @Input() initialPartners: Partner[] = [];
  @Input() initialCommercials: ManagedUser[] = [];

  @Output() save = new EventEmitter<SalePayload>();
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SalePayload>();
  @Output() cancelled = new EventEmitter<void>();
  /** "Valider et encaisser" — même charge utile que `save`, mais le consommateur
   * enchaîne sur le panneau de paiement au lieu de revenir simplement à la liste. */
  @Output() saveAndPay = new EventEmitter<SalePayload>();

  private readonly productService = inject(ProductService);
  private readonly stockService = inject(StockService);
  private readonly clientService = inject(ClientService);
  private readonly cityService = inject(CityService);

  // ── Catalogue de lots (volet gauche) ─────────────────────────────────────
  lotSearch = signal('');
  lots = signal<Stock[]>([]);
  loadingLots = signal(false);
  private lotSearchLoaded = false;

  // ── Ligne libre : pièce ou prestation sans lot de stock ─────────────────
  showFreeLineForm = signal(false);
  freeLineType = signal<'part' | 'service'>('part');
  freeLineSearch = signal('');
  freeLineProducts = signal<Product[]>([]);
  loadingFreeLineProducts = signal(false);

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

  logisticsCollapsed = signal(true);
  vehicle_id = signal<number | null>(null);
  saleVehicleMileage = signal<number | null>(null);

  /** Quantités déjà engagées par lot, au chargement d'une vente existante — voir `lineAvailableStock`. */
  private originalQuantityByStockId = new Map<number, number>();

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

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities.set(cities));

    this.setupClientSearch();
    this.loadClients();

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

      for (const item of this.formData.items as any[]) {
        if (item.stock_id) {
          this.originalQuantityByStockId.set(
            item.stock_id,
            (this.originalQuantityByStockId.get(item.stock_id) || 0) + Number(item.quantity || 0),
          );
        }
      }

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Catalogue de lots ─────────────────────────────────────────────────────
  // Un seul gestionnaire pose le signal ET lance la recherche avec la valeur
  // qu'on vient de recevoir : un (ngModelChange) qui pose le signal PLUS un
  // (input) séparé qui relit ce signal peuvent s'exécuter dans un ordre où
  // le second voit encore l'ancienne valeur (les deux écoutent le même
  // événement natif "input", sans garantie d'ordre entre eux) — la recherche
  // partait alors toujours un caractère en retard.
  onLotSearchInput(value: string): void {
    this.lotSearch.set(value);
    const search = value.trim();
    if (!search && !this.lotSearchLoaded) {
      // Rien tapé pour l'instant : pas d'appel réseau, la liste reste vide.
      return;
    }

    this.lotSearchLoaded = true;
    this.loadingLots.set(true);
    this.stockService.getStocks({ search, in_stock: '1', per_page: '30' }).subscribe({
      next: (res) => {
        this.lots.set(res.data);
        this.loadingLots.set(false);
      },
      error: () => this.loadingLots.set(false),
    });
  }

  /** Quantité déjà présente au ticket pour ce lot (annotation "déjà au ticket ×N"). */
  ticketQuantityForStock(stockId: number): number {
    return (this.formData.items || [])
      .filter((item: any) => item.stock_id === stockId)
      .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  }

  addLotToTicket(stock: Stock): void {
    const item: any = {
      product_id: stock.product_id,
      stock_id: stock.id,
      quantity: 1,
      purchase_price: Number(stock.purchase_price ?? 0),
      // Pas de prix de vente catalogue pour pneus/pièces dans ce système (voir
      // Product model — seul ProductService a un selling_price) : la ligne
      // arrive à 0, le vendeur le saisit sur le ticket, comme aujourd'hui.
      selling_price: 0,
      discount: 0,
      linkedProduct: stock.product ?? null,
      stock,
    };

    this.formData.items!.push(item);
    this.calculateTotals();
  }

  // ── Ligne libre (pièce/prestation sans lot) ──────────────────────────────
  openFreeLineForm(type: 'part' | 'service'): void {
    this.freeLineType.set(type);
    this.showFreeLineForm.set(true);
    this.freeLineSearch.set('');
    this.freeLineProducts.set([]);
  }

  closeFreeLineForm(): void {
    this.showFreeLineForm.set(false);
  }

  onFreeLineSearchInput(value: string): void {
    this.freeLineSearch.set(value);
    this.searchFreeLineProducts();
  }

  searchFreeLineProducts(): void {
    this.loadingFreeLineProducts.set(true);
    const filters: Record<string, string> = { per_page: '20', is_active: '1', type: this.freeLineType() };
    if (this.freeLineSearch().trim()) {
      filters['search'] = this.freeLineSearch().trim();
    }

    this.productService.getProducts(filters).subscribe({
      next: (res) => {
        this.freeLineProducts.set(res.data);
        this.loadingFreeLineProducts.set(false);
      },
      error: () => this.loadingFreeLineProducts.set(false),
    });
  }

  addFreeLine(product: Product): void {
    const item: any = {
      product_id: product.id,
      stock_id: null,
      quantity: 1,
      purchase_price: 0,
      selling_price: product.type === 'service' ? Number(product.service?.selling_price ?? 0) : 0,
      discount: 0,
      linkedProduct: product,
      stock: null,
    };

    this.formData.items!.push(item);
    this.calculateTotals();
    this.showFreeLineForm.set(false);
  }

  // ── Édition en place sur la ligne du ticket ──────────────────────────────
  onLineQuantityChange(item: any, value: number): void {
    item.quantity = Math.max(1, Number(value) || 1);
    this.calculateTotals();
  }

  onLineSellingPriceChange(item: any, value: number): void {
    item.selling_price = Math.max(0, Number(value) || 0);
    this.calculateTotals();
  }

  onLineDiscountChange(item: any, value: number): void {
    item.discount = Math.max(0, Math.min(100, Number(value) || 0));
    this.calculateTotals();
  }

  /** Stock disponible pour cette ligne, en réintégrant ce que la vente en cours d'édition avait déjà engagé sur ce même lot (sinon on se bloquerait soi-même). */
  lineAvailableStock(item: any): number | null {
    if (!item.stock_id || !item.stock) return null;
    const original = this.originalQuantityByStockId.get(item.stock_id) || 0;
    return Number(item.stock.quantity ?? 0) + original;
  }

  lineStockInsufficient(item: any): boolean {
    const available = this.lineAvailableStock(item);
    if (available === null) return false;
    return Number(item.quantity || 0) > available;
  }

  // Méthode simple, pas un `computed()` : elle lit `formData.items`, une
  // propriété ordinaire (pas un signal) mutée en place par push/splice —
  // un computed() ne recalculerait jamais après sa première lecture. Ce
  // composant n'est pas OnPush, donc la détection de changement par défaut
  // la réévalue à chaque passage, comme le reste des champs de formData.
  hasStockIssues(): boolean {
    return (this.formData.items || []).some((item: any) => this.lineStockInsufficient(item));
  }

  removeItem(index: number): void {
    this.formData.items!.splice(index, 1);
    this.calculateTotals();
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

  lineMarginPct(item: any): number | null {
    const sell = Number(item.selling_price ?? item.unit_price ?? 0);
    if (!sell) return null;
    const purchase = Number(item.purchase_price || 0);
    return ((sell - purchase) / sell) * 100;
  }

  calculateTotals(): void {
    let totalPurchase = 0;
    let totalSale = 0;
    let totalQuantity = 0;
    let totalDiscountAmount = 0;

    for (const item of this.formData.items || []) {
      totalPurchase += Number(item.purchase_price || 0) * Number(item.quantity || 1);
      totalSale += this.lineTotal(item);
      totalQuantity += Number(item.quantity || 0);
      const grossLine = Number(item.selling_price ?? item.unit_price ?? 0) * Number(item.quantity || 1);
      totalDiscountAmount += grossLine - this.lineTotal(item);
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
    this.totalDiscountAmount.set(totalDiscountAmount);
  }

  /** Ligne "Remises accordées" du pied de ticket — somme des remises appliquées, pas un champ saisi. */
  totalDiscountAmount = signal(0);

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

  private validate(): boolean {
    if (!this.formData.commercial_id) {
      alert('Veuillez sélectionner un commercial.');
      return false;
    }
    if (!this.formData.partner_id) {
      alert('Veuillez sélectionner un partenaire.');
      return false;
    }
    if (!this.formData.items || this.formData.items.length === 0) {
      alert('Veuillez ajouter au moins un produit.');
      return false;
    }
    if (this.hasStockIssues()) {
      alert('Quantité insuffisante en stock sur au moins une ligne.');
      return false;
    }
    return true;
  }

  onSubmit(): void {
    if (!this.validate()) return;

    this.calculateTotals();
    const payload = this.buildPayload();
    this.save.emit(payload);
    this.saved.emit(payload);
  }

  /** "Valider et encaisser" — même validation, un événement différent pour que la page hôte enchaîne sur le paiement. */
  onSubmitAndPay(): void {
    if (!this.validate()) return;

    this.calculateTotals();
    const payload = this.buildPayload();
    this.saveAndPay.emit(payload);
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
}
