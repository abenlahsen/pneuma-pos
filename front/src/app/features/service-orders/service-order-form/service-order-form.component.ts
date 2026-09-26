import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, ElementRef, ViewChild,
  signal, computed, effect, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';
import {
  PartSearchResult,
  ServiceOrder,
  ServiceOrderPayload,
  ServicePayment,
} from '../../../core/models/service-order.model';
import { ServiceOrderStatus, SERVICE_ORDER_STATUSES, SERVICE_ORDER_STATUS_LABELS } from '../../../core/constants/status.constants';
import { ServiceOrderService } from '../data-access/service-order.service';
import { ClientService } from '../../clients/data-access/client.service';
import { Client } from '../../clients/models/client.model';
import { ProductService } from '../../products/data-access/product.service';
import { Vehicle } from '../../../features/vehicles/models/vehicle.model';
import { VehicleSelectorComponent } from '../../../shared/vehicle-selector/vehicle-selector.component';
import { QuickClientFormComponent } from '../../../shared/quick-client-form/quick-client-form.component';

export interface ServiceProductOption {
  id: number;
  profile: string | null;
  reference: string | null;
  selling_price: number | null;
}

export interface ServiceLineForm {
  item_type: 'service';
  service_type: string;
  description: string;
  quantity: number;
  purchase_price: number;
  parts_cost: number;
  labor_cost: number;
}

export interface PartLineForm {
  item_type: 'part';
  product_id: number | null;
  stock_id: number | null;
  product_name: string;
  product_reference: string;
  unit: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  total_quantity: number;
  searchQuery: string;
  searchResults: PartSearchResult[];
  searching: boolean;
}

export type AnyLineForm = ServiceLineForm | PartLineForm;

/**
 * Les états que suit la barre de titre — maquette 20a.
 *
 * La base ne connaît que trois statuts (EN COURS, TERMINE, ANNULE) : « facturée »
 * n'en est pas un. On reprend donc la lecture de la vue Atelier, qui range en
 * « Facturé » une intervention terminée qui a reçu au moins un paiement, et
 * dont le bouton « Facturer » ouvre l'encaissement.
 */
export type ServiceOrderStep = 'new' | 'in_progress' | 'finished' | 'invoiced' | 'cancelled';

/** Ce que l'écran demande à la page : enregistrer, en changeant ou non le statut. */
export interface ServiceOrderSaveRequest {
  payload: ServiceOrderPayload;
  /** Après l'enregistrement, ouvrir l'encaissement (Facturer / Encaisser). */
  thenCollect?: boolean;
}

/**
 * L'intervention en un écran — refonte 2b, étape 12a, maquette 20a.
 *
 * La fiche (modale de consultation) et le formulaire (modale de saisie, trois
 * sections empilées) ne font plus qu'un écran éditable, sur le gabarit 15a :
 * barre de titre, lignes à gauche, client, suivi et totaux à droite, pied
 * d'actions. Sur le pont, l'intervention se construit au fil du travail ;
 * son état avance dans la barre.
 *
 * Toute la logique de l'ancien formulaire est conservée — recherche de pièces,
 * catalogue de prestations, calculs, validation, client et véhicule. Ce qui
 * change est la présentation : une grille de lignes unique pour les
 * prestations et les pièces, une ligne d'ajout, et les actions qui suivent
 * l'état.
 */
@Component({
  selector: 'app-service-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VehicleSelectorComponent, QuickClientFormComponent, IconComponent],
  templateUrl: './service-order-form.component.html',
  styleUrls: ['./service-order-form.component.scss'],
})
export class ServiceOrderFormComponent implements OnInit, OnDestroy, OnChanges {
  readonly SERVICE_ORDER_STATUSES = SERVICE_ORDER_STATUSES;
  readonly SERVICE_ORDER_STATUS_LABELS = SERVICE_ORDER_STATUS_LABELS;

  @Input() serviceOrder: ServiceOrder | null = null;
  @Input() initialCommercials: { id: number; name: string }[] = [];
  /** Les paiements enregistrés, tenus à jour par la page après un encaissement. */
  @Input() payments: ServicePayment[] = [];
  /** La marge n'est montrée qu'avec la permission « view margins ». */
  @Input() canSeeMargin = false;
  /** Un enregistrement est en cours : les actions attendent. */
  @Input() busy = false;
  @Input() canDelete = false;

  @Output() save = new EventEmitter<ServiceOrderSaveRequest>();
  @Output() cancel = new EventEmitter<void>();
  @Output() cancelOrder = new EventEmitter<void>();
  @Output() collect = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() orderPart = new EventEmitter<PartLineForm>();

  @ViewChild('addInput') addInputRef?: ElementRef<HTMLInputElement>;

  private clientService = inject(ClientService);
  private productService = inject(ProductService);
  private serviceOrderService = inject(ServiceOrderService);

  serviceProducts = signal<ServiceProductOption[]>([]);
  quickServiceChips = computed(() => this.serviceProducts().slice(0, 6));
  activeServiceDropdown = signal<number>(-1);

  showQuickCreate = signal(false);

  // Form header fields
  date = signal(new Date().toISOString().split('T')[0]);
  vehicle = signal('');
  vehicle_id = signal<number | null>(null);
  selectedVehicleObj = signal<Vehicle | null>(null);
  mileage = signal<number | null>(null);
  discount = signal(0);
  status = signal<ServiceOrderStatus>('EN COURS');
  notes = signal('');
  commercial_id = signal<number | null>(null);

  // Client link
  client_id = signal<number | null>(null);
  selectedClient = signal<Client | null>(null);
  clients = signal<Client[]>([]);
  filteredClients = signal<Client[]>([]);
  clientSearch = signal('');
  showClientSuggestions = signal(false);
  loadingClients = signal(false);

  private readonly clientSearchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  // Lines — l'écran démarre sans ligne : la ligne d'ajout en tient lieu.
  lines = signal<AnyLineForm[]>([]);

  totalAmount = computed(() =>
    this.lines().reduce((sum, line) => {
      if (line.item_type === 'part') {
        return sum + (Number(line.quantity) || 1) * (Number(line.unit_price) || 0);
      }
      return sum + (Number(line.quantity) || 1) * (Number(line.labor_cost) || 0);
    }, 0)
  );

  netAmount = computed(() =>
    Math.max(0, this.totalAmount() * (1 - (Number(this.discount()) || 0) / 100))
  );

  totalPurchase = computed(() =>
    this.lines().reduce((sum, line) => {
      return sum + (Number(line.quantity) || 1) * (Number(line.purchase_price) || 0);
    }, 0)
  );

  totalMargin = computed(() => this.totalAmount() - this.totalPurchase());

  readonly vehicleValid = computed(() => {
    if (this.client_id()) return true;          // véhicule optionnel quand client lié
    return this.vehicle().trim().length > 0;    // requis en saisie libre
  });

  hasValidLines = computed(() =>
    this.lines().some(line => {
      if (line.item_type === 'service') return line.service_type.trim().length > 0;
      return line.product_id !== null;
    })
  );

  hasStockError = computed(() =>
    this.lines().some(line => {
      if (line.item_type !== 'part') return false;
      if (!line.product_id) return false;
      return line.total_quantity < (Number(line.quantity) || 1);
    })
  );

  stockErrorMessage = computed(() => {
    const bad = this.lines().filter(line =>
      line.item_type === 'part' && line.product_id && line.total_quantity < (Number(line.quantity) || 1)
    ) as PartLineForm[];
    if (!bad.length) return '';
    return bad.map(l =>
      l.total_quantity === 0
        ? `${l.product_name || 'Pièce'} : rupture de stock`
        : `${l.product_name || 'Pièce'} : stock insuffisant (dispo ${l.total_quantity}, demandé ${l.quantity})`
    ).join(' • ');
  });

  // ── Refonte 2b, 12a : ce que l'écran ajoute ──────────────────────────────

  /** Les sous-totaux de la colonne de droite. */
  readonly servicesTotal = computed(() =>
    this.lines().reduce((sum, l) => l.item_type === 'service' ? sum + this.serviceLineTotal(l) : sum, 0)
  );

  readonly partsTotal = computed(() =>
    this.lines().reduce((sum, l) => l.item_type === 'part' ? sum + this.partLineTotal(l) : sum, 0)
  );

  readonly discountAmount = computed(() => Math.max(0, this.totalAmount() - this.netAmount()));

  /** Marge après remise : c'est celle que l'intervention rapporte. */
  readonly netMargin = computed(() => this.netAmount() - this.totalPurchase());

  readonly netMarginPct = computed(() => {
    const net = this.netAmount();
    return net > 0 ? (this.netMargin() / net) * 100 : 0;
  });

  readonly serviceCount = computed(() => this.lines().filter(l => l.item_type === 'service').length);
  readonly partCount = computed(() => this.lines().filter(l => l.item_type === 'part').length);

  /** Les pièces dont la quantité dépasse le stock : fond ocre, et « Commander la pièce ». */
  readonly shortLines = computed(() =>
    this.lines().filter(l => this.isShortage(l)) as PartLineForm[]
  );

  readonly paidTotal = computed(() =>
    (this.paymentsSignal() ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  );

  readonly remaining = computed(() => Math.max(0, Math.round((this.netAmount() - this.paidTotal()) * 100) / 100));

  /** L'étape de la barre de titre, et donc l'action principale du pied. */
  readonly step = computed<ServiceOrderStep>(() => {
    if (!this.serviceOrder) return 'new';
    const status = this.status();
    if (status === 'ANNULE') return 'cancelled';
    if (status === 'EN COURS') return 'in_progress';
    return this.paidTotal() > 0.004 ? 'invoiced' : 'finished';
  });

  readonly canSave = computed(() =>
    this.hasValidLines() && this.vehicleValid() && this.commercial_id() !== null
  );

  /** Ce qui manque pour enregistrer, dit en clair au pied de l'écran. */
  readonly missingHint = computed(() => {
    if (!this.hasValidLines()) return 'Ajoutez au moins une prestation ou une pièce.';
    if (!this.vehicleValid()) return 'Indiquez le véhicule, ou liez un client.';
    if (this.commercial_id() === null) return 'Choisissez le mécanicien.';
    return '';
  });

  // Ligne d'ajout
  readonly addType = signal<'service' | 'part'>('service');
  readonly addQuery = signal('');
  readonly addOpen = signal(false);
  readonly addPartResults = signal<PartSearchResult[]>([]);
  readonly addSearching = signal(false);
  private readonly addPartSearch$ = new Subject<string>();

  readonly addServiceSuggestions = computed(() =>
    this.addType() === 'service' ? this.filteredServiceSuggestions(this.addQuery()) : []
  );

  // Client : solde dû, et dernière visite du véhicule
  readonly clientBalance = signal<number | null>(null);
  readonly lastVisit = signal<ServiceOrder | null>(null);

  /** Les paiements arrivent en entrée : on les suit en signal pour les calculs. */
  private readonly paymentsSignal = signal<ServicePayment[]>([]);

  /** L'instantané de ce qui serait enregistré, pour savoir si l'écran a changé. */
  private readonly initialSnapshot = signal<string | null>(null);
  readonly snapshot = computed(() => JSON.stringify(this.buildPayload()));
  readonly dirty = computed(() => this.initialSnapshot() !== null && this.snapshot() !== this.initialSnapshot());

  constructor() {
    // La dernière visite suit le véhicule choisi.
    effect(() => {
      const vehicleId = this.vehicle_id();
      this.loadLastVisit(vehicleId);
    });

    // Le solde dû suit le client lié.
    effect(() => {
      const clientId = this.client_id();
      this.loadClientBalance(clientId);
    });
  }

  ngOnChanges(): void {
    this.paymentsSignal.set(this.payments ?? []);
  }

  ngOnInit(): void {
    this.paymentsSignal.set(this.payments ?? []);
    this.loadServiceProducts();

    if (this.serviceOrder) {
      this.date.set(this.serviceOrder.date);
      this.vehicle.set(this.serviceOrder.vehicle);
      this.vehicle_id.set(this.serviceOrder.vehicle_id ?? null);
      this.mileage.set(this.serviceOrder.mileage ?? null);
      this.discount.set(Number(this.serviceOrder.discount) || 0);
      this.status.set(this.serviceOrder.status);
      this.notes.set(this.serviceOrder.notes ?? '');
      this.commercial_id.set(this.serviceOrder.commercial_id ?? null);
      this.client_id.set(this.serviceOrder.client_id ?? null);
      this.clientSearch.set(this.serviceOrder.client_record?.name ?? '');
      if (this.serviceOrder.client_record && this.serviceOrder.client_id) {
        this.selectedClient.set({
          id: this.serviceOrder.client_id,
          name: this.serviceOrder.client_record.name,
          phone: this.serviceOrder.client_record.phone ?? '',
        } as Client);
      }

      if (this.serviceOrder.items?.length) {
        const mapped: AnyLineForm[] = this.serviceOrder.items.map(it => {
          if (it.item_type === 'part') {
            return {
              item_type: 'part',
              product_id: it.product_id ?? null,
              stock_id: it.stock_id ?? null,
              product_name: it.product_name ?? '',
              product_reference: it.product_reference ?? '',
              unit: 'pièce',
              quantity: it.quantity ?? 1,
              unit_price: Number(it.unit_price) || 0,
              purchase_price: Number(it.purchase_price) || 0,
              // Le stock restant ne compte plus ce que l'intervention a déjà
              // sorti : on le rajoute, sinon une pièce prise au dernier
              // exemplaire se lirait « 0 en stock pour 1 demandée ».
              total_quantity: (it.total_quantity ?? 0) + (Number(it.deducted_quantity) || 0),
              searchQuery: it.product_name ?? '',
              searchResults: [],
              searching: false,
            } as PartLineForm;
          }
          return {
            item_type: 'service',
            service_type: it.service_type ?? '',
            description: it.description ?? '',
            quantity: Number(it.quantity) || 1,
            purchase_price: Number(it.purchase_price) || 0,
            parts_cost: Number(it.parts_cost) || 0,
            labor_cost: Number(it.labor_cost) || 0,
          } as ServiceLineForm;
        });
        this.lines.set(mapped);
      }
    } else if (this.initialCommercials.length === 1) {
      this.commercial_id.set(this.initialCommercials[0].id);
    }

    this.setupClientSearch();
    this.setupAddPartSearch();
    this.loadClients();

    this.initialSnapshot.set(this.snapshot());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Après un enregistrement réussi, l'écran repart propre. */
  markSaved(): void {
    this.initialSnapshot.set(this.snapshot());
  }

  private loadServiceProducts(): void {
    this.productService.getProducts({ type: 'service', is_active: '1', per_page: '500' }).subscribe({
      next: (res) => {
        this.serviceProducts.set(res.data.map(p => ({
          id: p.id,
          profile: p.profile,
          reference: p.reference,
          selling_price: p.service?.selling_price ?? null,
        })));
      },
      error: () => this.serviceProducts.set([]),
    });
  }

  private loadClients(): void {
    this.loadingClients.set(true);
    this.clientService.getClients({ per_page: 20, status: 'active' }).pipe(
      finalize(() => this.loadingClients.set(false))
    ).subscribe({
      next: (list) => {
        this.clients.set(list);
        this.filteredClients.set(list.slice(0, 8));

        if (this.client_id()) {
          const found = list.find(c => c.id === this.client_id());
          if (found) {
            this.selectedClient.set(found);
          }
        }
      },
      error: () => {
        this.clients.set([]);
        this.filteredClients.set([]);
      },
    });
  }

  private loadClientBalance(clientId: number | null): void {
    this.clientBalance.set(null);
    if (!clientId) return;
    this.clientService.getClientProfile(clientId).subscribe({
      next: (profile) => this.clientBalance.set(Number(profile?.outstanding_balance ?? 0)),
      error: () => this.clientBalance.set(null),
    });
  }

  /** La visite précédente du même véhicule — jamais l'intervention en cours. */
  private loadLastVisit(vehicleId: number | null): void {
    this.lastVisit.set(null);
    if (!vehicleId) return;
    this.serviceOrderService.getServiceOrders({
      vehicle_id: String(vehicleId),
      exclude_status: 'ANNULE',
      per_page: '5',
    }).subscribe({
      next: (res) => {
        const currentId = this.serviceOrder?.id;
        const previous = (res.data ?? []).find(o => o.id !== currentId) ?? null;
        this.lastVisit.set(previous);
      },
      error: () => this.lastVisit.set(null),
    });
  }

  lastVisitLabel(): string {
    const v = this.lastVisit();
    if (!v) return '';
    const parts: string[] = [];
    if (v.mileage) parts.push(`${Number(v.mileage).toLocaleString('fr-FR')} km`);
    const [, m, d] = (v.date ?? '').slice(0, 10).split('-');
    const when = d && m ? `le ${d}/${m}` : '';
    const what = (v.items ?? []).map(i => i.item_type === 'part' ? i.product_name : i.service_type)
      .filter(Boolean).slice(0, 2).join(', ').toLowerCase();
    return `Dernière visite ${[parts.join(''), when].filter(Boolean).join(', ')}${what ? ' — ' + what : ''}`;
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
        this.loadingClients.set(true);
        return this.clientService.getClients({ search: trimmed, per_page: 20, status: 'active' }).pipe(
          finalize(() => this.loadingClients.set(false)),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(clients => {
      this.filteredClients.set(clients.slice(0, 8));
    });
  }

  private setupAddPartSearch(): void {
    this.addPartSearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => {
        if (term.trim().length < 2) {
          this.addSearching.set(false);
          return of([] as PartSearchResult[]);
        }
        this.addSearching.set(true);
        return this.serviceOrderService.searchParts(term.trim()).pipe(
          finalize(() => this.addSearching.set(false)),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(results => this.addPartResults.set(results));
  }

  // --- Quick client creation ---

  openQuickCreate(): void {
    this.showQuickCreate.set(true);
    this.showClientSuggestions.set(false);
  }

  onQuickClientCreated(client: Client): void {
    this.clients.update(list => [client, ...list.filter(c => c.id !== client.id)]);
    this.selectClient(client);
    this.showQuickCreate.set(false);
  }

  // --- Lines management ---

  addServiceLine(): void {
    this.lines.update(l => [...l, {
      item_type: 'service', service_type: '', description: '', quantity: 1, purchase_price: 0, parts_cost: 0, labor_cost: 0,
    }]);
  }

  addPartLine(): void {
    this.lines.update(l => [...l, {
      item_type: 'part',
      product_id: null, stock_id: null, product_name: '', product_reference: '',
      unit: 'pièce', quantity: 1, unit_price: 0, purchase_price: 0, total_quantity: 0,
      searchQuery: '', searchResults: [], searching: false,
    }]);
  }

  /**
   * Retire une ligne. L'ancien formulaire gardait toujours une ligne vide ;
   * ici la ligne d'ajout en tient lieu, on peut donc tout retirer — la
   * validation (au moins une ligne valide) reste la même.
   */
  removeLine(index: number): void {
    this.lines.update(l => l.filter((_, i) => i !== index));
  }

  updateLine(index: number, patch: Partial<AnyLineForm>): void {
    this.lines.update(list => {
      const copy = [...list];
      copy[index] = { ...copy[index], ...patch } as AnyLineForm;
      return copy;
    });
  }

  asService(line: AnyLineForm): ServiceLineForm {
    return line as ServiceLineForm;
  }

  asPart(line: AnyLineForm): PartLineForm {
    return line as PartLineForm;
  }

  // --- Part search ---

  searchPartsFor(index: number, query: string): void {
    this.updateLine(index, { searchQuery: query } as Partial<PartLineForm>);
    if (query.length < 2) {
      this.updateLine(index, { searchResults: [] } as Partial<PartLineForm>);
      return;
    }
    this.updateLine(index, { searching: true } as Partial<PartLineForm>);
    this.serviceOrderService.searchParts(query).subscribe({
      next: (results) => this.updateLine(index, { searchResults: results, searching: false } as Partial<PartLineForm>),
      error: () => this.updateLine(index, { searching: false } as Partial<PartLineForm>),
    });
  }

  selectPart(index: number, part: PartSearchResult): void {
    this.updateLine(index, {
      product_id: part.id,
      stock_id: part.stock_id ?? null,
      product_name: part.name,
      product_reference: part.reference ?? '',
      unit: part.unit,
      unit_price: part.purchase_price,
      purchase_price: part.purchase_price,
      total_quantity: part.total_quantity,
      searchQuery: part.name,
      searchResults: [],
    } as Partial<PartLineForm>);
  }

  clearPartSelection(index: number): void {
    this.updateLine(index, {
      product_id: null, product_name: '', product_reference: '',
      searchQuery: '', searchResults: [],
    } as Partial<PartLineForm>);
  }

  // --- Quick-add chips ---

  addQuickServiceLine(product: ServiceProductOption): void {
    this.lines.update(l => [...l, {
      item_type: 'service',
      service_type: product.profile ?? '',
      description: '',
      quantity: 1,
      purchase_price: 0,
      parts_cost: 0,
      labor_cost: Number(product.selling_price) || 0,
    }]);
  }

  // --- Service type autocomplete ---

  filteredServiceSuggestions(query: string): ServiceProductOption[] {
    if (!query.trim()) return this.serviceProducts().slice(0, 8);
    const q = query.toLowerCase();
    return this.serviceProducts()
      .filter(p => (p.profile ?? '').toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  onServiceTypeInput(index: number, value: string): void {
    this.updateLine(index, { service_type: value } as Partial<ServiceLineForm>);
    this.activeServiceDropdown.set(index);
  }

  selectServiceFromCatalog(index: number, product: ServiceProductOption): void {
    this.updateLine(index, {
      service_type: product.profile ?? '',
      labor_cost: Number(product.selling_price) || 0,
    } as Partial<ServiceLineForm>);
    this.activeServiceDropdown.set(-1);
  }

  closeServiceDropdown(): void {
    this.activeServiceDropdown.set(-1);
  }

  /** Au départ du champ : laisse le clic sur une suggestion arriver d'abord. */
  closeServiceDropdownSoon(): void {
    setTimeout(() => this.closeServiceDropdown(), 150);
  }

  // --- La ligne d'ajout (refonte 2b, 12a) ---

  /** « + Prestation » et « + Pièce » choisissent le type, puis donnent la main à la ligne. */
  setAddType(type: 'service' | 'part'): void {
    this.addType.set(type);
    this.addOpen.set(true);
    if (type === 'part') this.addPartSearch$.next(this.addQuery());
    setTimeout(() => this.addInputRef?.nativeElement.focus());
  }

  onAddQueryInput(value: string): void {
    this.addQuery.set(value);
    this.addOpen.set(true);
    if (this.addType() === 'part') this.addPartSearch$.next(value);
  }

  /**
   * Entrée : la première suggestion. Une prestation sans correspondance au
   * catalogue s'ajoute en saisie libre, sous le nom tapé ; une pièce doit
   * exister au catalogue.
   */
  commitAdd(): void {
    const query = this.addQuery().trim();
    if (this.addType() === 'service') {
      const first = query ? this.addServiceSuggestions()[0] : undefined;
      if (first) this.addServiceFromCatalog(first);
      else if (query) this.addFreeService(query);
      return;
    }
    const part = this.addPartResults()[0];
    if (part) this.addPartFromSearch(part);
  }

  addServiceFromCatalog(product: ServiceProductOption): void {
    this.addQuickServiceLine(product);
    this.resetAdd();
  }

  addFreeService(name: string): void {
    this.lines.update(l => [...l, {
      item_type: 'service', service_type: name, description: '', quantity: 1,
      purchase_price: 0, parts_cost: 0, labor_cost: 0,
    }]);
    this.resetAdd();
  }

  addPartFromSearch(part: PartSearchResult): void {
    this.addPartLine();
    this.selectPart(this.lines().length - 1, part);
    this.resetAdd();
  }

  private resetAdd(): void {
    this.addQuery.set('');
    this.addPartResults.set([]);
    this.addOpen.set(false);
    // La ligne garde le type choisi : on enchaîne les pièces, ou les prestations.
    setTimeout(() => this.addInputRef?.nativeElement.focus());
  }

  closeAdd(): void {
    // Laisse le temps au clic sur une suggestion d'arriver avant de fermer.
    setTimeout(() => this.addOpen.set(false), 150);
  }

  // --- Lecture d'une ligne ---

  isShortage(line: AnyLineForm): boolean {
    return line.item_type === 'part'
      && !!line.product_id
      && line.total_quantity < (Number(line.quantity) || 1);
  }

  isCatalogService(line: AnyLineForm): boolean {
    if (line.item_type !== 'service') return false;
    const name = line.service_type.trim().toLowerCase();
    return !!name && this.serviceProducts().some(p => (p.profile ?? '').trim().toLowerCase() === name);
  }

  /** « 1 en stock pour 2 demandées » : ce qui manque, dit avec les deux chiffres. */
  stockLabel(line: PartLineForm): string {
    const qty = Number(line.quantity) || 1;
    if (line.total_quantity < qty) {
      return `${line.total_quantity} en stock pour ${qty} demandée${qty > 1 ? 's' : ''}`;
    }
    return `${line.total_quantity} en stock`;
  }

  /** Le résumé de la rupture au pied : « plaquettes, 1 sur 2 ». */
  shortageSummary(): string {
    const short = this.shortLines();
    if (short.length === 1) {
      const l = short[0];
      return `Une pièce manque (${l.product_name}, ${l.total_quantity} sur ${Number(l.quantity) || 1})`;
    }
    return `${short.length} pièces manquent`;
  }

  // --- Client ---

  onClientSearchInput(value: string): void {
    this.clientSearch.set(value);
    this.showClientSuggestions.set(true);
    this.clientSearchSubject.next(value);
  }

  selectClient(c: Client): void {
    this.selectedClient.set(c);
    this.client_id.set(c.id);
    this.clientSearch.set(c.name);
    this.showClientSuggestions.set(false);
    this.vehicle_id.set(null);
    this.selectedVehicleObj.set(null);
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.client_id.set(null);
    this.clientSearch.set('');
    this.showClientSuggestions.set(false);
    this.vehicle_id.set(null);
    this.selectedVehicleObj.set(null);
  }

  onVehicleSelected(vehicle: Vehicle | null): void {
    this.selectedVehicleObj.set(vehicle);
    this.vehicle_id.set(vehicle?.id ?? null);
  }

  // --- Submit ---

  /** Le corps envoyé à l'API, pour un statut donné (celui de l'écran par défaut). */
  buildPayload(status: ServiceOrderStatus = this.status()): ServiceOrderPayload {
    const items = this.lines().map((line, i) => {
      if (line.item_type === 'part') {
        return {
          item_type: 'part' as const,
          product_id: line.product_id,
          stock_id: line.stock_id ?? null,
          quantity: line.quantity,
          unit_price: line.unit_price,
          purchase_price: line.purchase_price,
          sort_order: i,
        };
      }
      return {
        item_type: 'service' as const,
        service_type: line.service_type || null,
        description: line.description || null,
        quantity: line.quantity,
        purchase_price: line.purchase_price,
        parts_cost: 0,
        labor_cost: line.labor_cost,
        sort_order: i,
      };
    });

    const resolvedVehicle = this.selectedVehicleObj()
      ? `${this.selectedVehicleObj()!.brand} ${this.selectedVehicleObj()!.model_name}`
      : this.vehicle();

    return {
      client_id: this.client_id(),
      vehicle_id: this.vehicle_id(),
      date: this.date(),
      vehicle: resolvedVehicle,
      mileage: this.mileage(),
      items,
      discount: Number(this.discount()) || 0,
      status,
      notes: this.notes() || null,
      commercial_id: this.commercial_id(),
    };
  }

  /** Enregistre tel quel, sans changer l'état. */
  onSubmit(): void {
    if (!this.canSave() || this.busy) return;
    this.save.emit({ payload: this.buildPayload() });
  }

  /** « Terminer l'intervention » : enregistre et passe au statut TERMINE. */
  finish(): void {
    if (!this.canSave() || this.busy) return;
    this.status.set('TERMINE');
    this.save.emit({ payload: this.buildPayload('TERMINE') });
  }

  /** « Rétablir » une intervention annulée : elle repart en cours. */
  reopen(): void {
    if (!this.canSave() || this.busy) return;
    this.status.set('EN COURS');
    this.save.emit({ payload: this.buildPayload('EN COURS') });
  }

  /**
   * « Facturer » et « Encaisser » ouvrent le volet d'encaissement. Une
   * modification non enregistrée l'est d'abord : on n'encaisse pas un
   * montant que la base ne connaît pas.
   */
  collectPayment(): void {
    if (this.busy) return;
    if (this.dirty()) {
      if (!this.canSave()) return;
      this.save.emit({ payload: this.buildPayload(), thenCollect: true });
      return;
    }
    this.collect.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  trackByIndex(_: number, __: unknown): number {
    return _;
  }

  serviceLineTotal(line: ServiceLineForm): number {
    return (Number(line.quantity) || 1) * (Number(line.labor_cost) || 0);
  }

  partLineTotal(line: PartLineForm): number {
    return (Number(line.quantity) || 1) * (Number(line.unit_price) || 0);
  }

  lineTotal(line: AnyLineForm): number {
    return line.item_type === 'part' ? this.partLineTotal(line) : this.serviceLineTotal(line);
  }

  /** « ouverte le 17/09 à 09:40 » — l'heure d'ouverture de la barre. */
  openedAt(): string {
    const at = this.serviceOrder?.created_at;
    if (!at) return '';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    const two = (n: number) => String(n).padStart(2, '0');
    return `ouverte le ${two(d.getDate())}/${two(d.getMonth() + 1)} à ${two(d.getHours())}:${two(d.getMinutes())}`;
  }

  mechanicName(): string {
    const id = this.commercial_id();
    return this.initialCommercials.find(c => c.id === id)?.name ?? this.serviceOrder?.commercial?.name ?? '';
  }

  /** La plaque en tête de barre ; à défaut le véhicule saisi. */
  plate(): string {
    return this.selectedVehicleObj()?.plate
      || this.serviceOrder?.vehicle_data?.plate
      || '';
  }

  vehicleName(): string {
    const v = this.selectedVehicleObj();
    if (v) return `${v.brand} ${v.model_name}`;
    const data = this.serviceOrder?.vehicle_data;
    if (data && data.id === this.vehicle_id()) return `${data.brand} ${data.model_name}`;
    return this.vehicle();
  }

  get isEditing(): boolean {
    return this.serviceOrder !== null;
  }
}
