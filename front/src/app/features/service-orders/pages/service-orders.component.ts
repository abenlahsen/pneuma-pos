import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ServiceOrder, ServiceOrderFilters, ServiceOrderPayload, ServiceOrderSummary } from '../../../core/models/service-order.model';
import { PaymentStatus, ServiceOrderStatus, SERVICE_ORDER_STATUSES, SERVICE_ORDER_STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from '../../../core/constants/status.constants';
import { ServiceOrderService } from '../data-access/service-order.service';
import { ServiceOrderFormComponent } from '../service-order-form/service-order-form.component';
import { ServiceOrderDetailComponent } from '../service-order-detail/service-order-detail.component';
import { ServicePaymentPanelComponent } from '../service-payment-panel/service-payment-panel.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonCellsComponent,
  describeLoadError,
  frenchDate,
} from '../../../shared/list-state';

@Component({
  selector: 'app-service-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ServiceOrderFormComponent,
    ServiceOrderDetailComponent,
    ServicePaymentPanelComponent, IconComponent, SkeletonCellsComponent, ListEmptyComponent, ListErrorComponent],
  templateUrl: './service-orders.component.html',
  styleUrls: ['./service-orders.component.scss'],
})
export class ServiceOrdersComponent implements OnInit {
  readonly SERVICE_ORDER_STATUSES = SERVICE_ORDER_STATUSES;
  readonly SERVICE_ORDER_STATUS_LABELS = SERVICE_ORDER_STATUS_LABELS;
  readonly PAYMENT_STATUSES = PAYMENT_STATUSES;
  readonly PAYMENT_STATUS_LABELS = PAYMENT_STATUS_LABELS;

  serviceOrders = signal<ServiceOrder[]>([]);
  summary = signal<ServiceOrderSummary>({ total_revenue: 0, total_purchase: 0, total_margin: 0, total_paid: 0, remaining: 0 });
  filterOptions = signal<ServiceOrderFilters>({ service_products: [], commercials: [], clients: [], accounts: [] });

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(20);

  filterSearch = signal('');
  filterClientId = signal<number | null>(null);
  filterProductId = signal<number | null>(null);
  filterStatus = signal('');
  filterPaymentStatus = signal('');
  filterPaymentMethod = signal('');
  filterCommercial = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');

  loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Refonte 2b : tant que le résumé n'est pas revenu, les cadrans affichent
   * « — » et non 0. Un 0 affirme un chiffre — « CA du jour : 0,00 DH » — que
   * l'on n'a pas encore, et qui restait affiché si la requête échouait.
   */
  readonly summaryLoaded = signal(false);

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const applied: ActiveFilter[] = [];
    const drop = (label: string, apply: () => void) => {
      applied.push({
        label,
        clear: () => {
          apply();
          this.currentPage.set(1);
          this.loadData();
          this.loadSummary();
          this.loadBoard();
        },
      });
    };

    if (this.filterSearch()) drop(`recherche « ${this.filterSearch()} »`, () => this.filterSearch.set(''));
    if (this.filterClientId() !== null) {
      const client = this.filterOptions().clients.find((c) => c.id === this.filterClientId());
      drop(`client ${client?.name ?? this.filterClientId()}`, () => this.filterClientId.set(null));
    }
    if (this.filterProductId() !== null) {
      const product = this.filterOptions().service_products.find((p) => p.id === this.filterProductId());
      const label = product?.profile || product?.reference || String(this.filterProductId());
      drop(`prestation ${label}`, () => this.filterProductId.set(null));
    }
    if (this.filterStatus()) {
      const label = SERVICE_ORDER_STATUS_LABELS[this.filterStatus() as ServiceOrderStatus] ?? this.filterStatus();
      drop(`statut ${label.toLowerCase()}`, () => this.filterStatus.set(''));
    }
    if (this.filterPaymentStatus()) drop(this.filterPaymentStatus().toLowerCase(), () => this.filterPaymentStatus.set(''));
    if (this.filterPaymentMethod()) drop(`règlement ${this.filterPaymentMethod().toLowerCase()}`, () => this.filterPaymentMethod.set(''));
    if (this.filterCommercial()) drop(`commercial ${this.filterCommercial()}`, () => this.filterCommercial.set(''));
    if (this.filterDateFrom()) drop(`à partir du ${frenchDate(this.filterDateFrom())}`, () => this.filterDateFrom.set(''));
    if (this.filterDateTo()) drop(`jusqu'au ${frenchDate(this.filterDateTo())}`, () => this.filterDateTo.set(''));

    return applied;
  });

  isExporting = signal(false);

  exportError = signal('');
  showForm = signal(false);
  loadingEdit = signal(false);
  loadingDetail = signal(false);
  editingOrder = signal<ServiceOrder | null>(null);
  detailOrder = signal<ServiceOrder | null>(null);
  paymentOrder = signal<ServiceOrder | null>(null);
  deletingId = signal<number | null>(null);

  /** Refonte 2b — vue atelier (gabarit C). */
  readonly viewMode = signal<'board' | 'list'>('board');
  readonly boardOrders = signal<ServiceOrder[]>([]);
  readonly loadingBoard = signal(false);

  private static readonly BOARD_COLUMN_LIMIT = 5;

  readonly marginPctOfRevenue = computed(() => {
    const revenue = Number(this.summary().total_revenue);
    return revenue > 0 ? (Number(this.summary().total_margin) / revenue) * 100 : 0;
  });

  readonly paidPctOfRevenue = computed(() => {
    const revenue = Number(this.summary().total_revenue);
    return revenue > 0 ? (Number(this.summary().total_paid) / revenue) * 100 : 0;
  });

  readonly unpaidOrdersCount = computed(() =>
    this.boardOrders().filter(o => (o.remaining ?? 0) > 0.004).length
  );

  readonly boardEnCours = computed(() =>
    this.boardOrders()
      .filter(o => o.status === 'EN COURS')
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  );

  readonly boardEnCoursSum = computed(() =>
    this.boardEnCours().reduce((sum, o) => sum + Number(o.net_amount || 0), 0)
  );

  /**
   * `Date.now()` doit être lu UNE FOIS par recalcul du computed, jamais depuis le
   * template : un appel direct type `elapsedLabel(order.created_at)` dans le HTML
   * est réévalué à chaque passage de détection de changement (y compris la passe
   * de vérification d'Angular en dev), ce qui déclenche
   * ExpressionChangedAfterItHasBeenCheckedError dès que la minute change entre les
   * deux passes. En le figeant ici, la vue ne change que quand boardOrders() est
   * rechargé.
   */
  readonly boardEnCoursView = computed(() => {
    const now = Date.now();
    return this.boardEnCours().map(order => ({
      order,
      elapsed: this.formatElapsed(now - new Date(order.created_at ?? now).getTime()),
    }));
  });

  readonly boardAFacturer = computed(() =>
    this.boardOrders()
      .filter(o => o.status === 'TERMINE' && o.payment_status === 'NON PAYE')
      .sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''))
  );

  readonly boardAFacturerVisible = computed(() =>
    this.boardAFacturer().slice(0, ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
  );

  readonly boardAFacturerOverflowCount = computed(() =>
    Math.max(0, this.boardAFacturer().length - ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
  );

  readonly boardAFacturerOverflowSum = computed(() =>
    this.boardAFacturer().slice(ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
      .reduce((sum, o) => sum + Number(o.remaining ?? o.net_amount ?? 0), 0)
  );

  readonly boardAFacturerSum = computed(() =>
    this.boardAFacturer().reduce((sum, o) => sum + Number(o.remaining ?? o.net_amount ?? 0), 0)
  );

  readonly boardAFacturerOldestDays = computed(() => {
    const list = this.boardAFacturer();
    if (!list.length) return 0;
    return this.formatDays(Date.now() - new Date(list[0].updated_at ?? Date.now()).getTime());
  });

  readonly boardAFacturerView = computed(() => {
    const now = Date.now();
    return this.boardAFacturerVisible().map(order => ({
      order,
      elapsed: this.formatElapsed(now - new Date(order.updated_at ?? now).getTime()),
    }));
  });

  readonly boardFacture = computed(() =>
    this.boardOrders()
      .filter(o => o.status === 'TERMINE' && o.payment_status !== 'NON PAYE')
      .sort((a, b) => {
        const aOwed = (a.remaining ?? 0) > 0.004 ? 0 : 1;
        const bOwed = (b.remaining ?? 0) > 0.004 ? 0 : 1;
        if (aOwed !== bOwed) return aOwed - bOwed;
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      })
  );

  readonly boardFactureVisible = computed(() =>
    this.boardFacture().slice(0, ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
  );

  readonly boardFactureOverflowCount = computed(() =>
    Math.max(0, this.boardFacture().length - ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
  );

  readonly boardFactureOverflowSum = computed(() =>
    this.boardFacture().slice(ServiceOrdersComponent.BOARD_COLUMN_LIMIT)
      .reduce((sum, o) => sum + Number(o.total_paid ?? 0), 0)
  );

  readonly boardFactureEncaisseSum = computed(() =>
    this.boardFacture().reduce((sum, o) => sum + Number(o.total_paid ?? 0), 0)
  );

  readonly boardFactureDueSum = computed(() =>
    this.boardFacture().reduce((sum, o) => sum + Number(o.remaining ?? 0), 0)
  );

  readonly boardFactureView = computed(() => {
    const now = Date.now();
    return this.boardFactureVisible().map(order => {
      const due = (order.remaining ?? 0) > 0.004;
      return {
        order,
        due,
        statusLabel: due
          ? `Non payé · ${this.formatDays(now - new Date(order.updated_at ?? now).getTime())} j`
          : 'Payé',
        amount: due ? (order.remaining ?? 0) : Number(order.net_amount ?? 0),
      };
    });
  });

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  constructor(
    private serviceOrderService: ServiceOrderService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadData();
    this.loadSummary();
    this.loadBoard();

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        if (!Number.isFinite(id) || id <= 0) return;

        this.serviceOrderService.getServiceOrder(id).subscribe({
          next: order => this.openDetail(order),
        });
      });
  }

  loadData(): void {
    this.loading.set(true);
    this.serviceOrderService.getServiceOrders(this.buildFilters()).subscribe({
      next: (res) => {
        this.serviceOrders.set(res.data);
        this.total.set(res.total);
        this.currentPage.set(res.current_page);
        this.lastPage.set(res.last_page);
        this.perPage.set(res.per_page);
        this.loading.set(false);
        this.loadError.set(null);
        this.lastLoadedAt.set(new Date());
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });
  }

  loadSummary(): void {
    this.serviceOrderService.getSummary(this.buildFilters()).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.summaryLoaded.set(true);
      },
      error: () => this.summaryLoaded.set(false),
    });
  }

  /** Vue atelier : jeu complet (non paginé) des interventions filtrées, réparti en trois colonnes côté client. */
  loadBoard(): void {
    this.loadingBoard.set(true);
    const filters = this.buildFilters();
    delete filters['page'];
    filters['per_page'] = '500';
    this.serviceOrderService.getServiceOrders(filters).subscribe({
      next: (res) => {
        this.boardOrders.set(res.data);
        this.loadingBoard.set(false);
      },
      error: () => this.loadingBoard.set(false),
    });
  }

  loadFilters(): void {
    this.serviceOrderService.getFilters().subscribe({
      next: (f) => this.filterOptions.set(f),
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
    this.loadSummary();
    this.loadBoard();
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterClientId.set(null);
    this.filterProductId.set(null);
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterPaymentMethod.set('');
    this.filterCommercial.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.applyFilters();
  }

  isMechanicActive(id: number): boolean {
    return this.filterCommercial() === String(id);
  }

  selectMechanic(id: number | null): void {
    this.filterCommercial.set(id === null ? '' : String(id));
    this.applyFilters();
  }

  /** Lien « Voir en liste » des colonnes tronquées : bascule en liste avec les filtres du seau. */
  viewBucketInList(bucket: 'a-facturer' | 'facture'): void {
    this.filterStatus.set('TERMINE');
    this.filterPaymentStatus.set(bucket === 'a-facturer' ? 'NON PAYE' : '');
    this.viewMode.set('list');
    this.applyFilters();
  }

  /**
   * Proxy honnête de « depuis quand » : aucun horodatage de changement de
   * statut n'existe côté back (service_orders n'a que created_at/updated_at).
   * created_at pour une intervention en cours (l'ouverture), updated_at pour
   * une intervention terminée (la dernière modification — se décale si la
   * fiche est rouverte/éditée après coup, faute de mieux).
   *
   * Pures (pas de Date.now() lu à l'appel) : appelées uniquement depuis les
   * computed() board*View ci-dessus, jamais depuis le template — un appel
   * direct depuis le HTML relit l'horloge à chaque passage de détection de
   * changement et déclenche ExpressionChangedAfterItHasBeenCheckedError.
   */
  private formatElapsed(ms: number): string {
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.round(hours / 24)} j`;
  }

  private formatDays(ms: number): number {
    return Math.max(0, Math.round(ms / 86400000));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.currentPage.set(page);
    this.loadData();
  }

  openAddForm(): void {
    this.editingOrder.set(null);
    this.showForm.set(true);
  }

  openDetail(order: ServiceOrder): void {
    this.detailOrder.set(order);
    this.loadingDetail.set(true);
    this.serviceOrderService.getServiceOrder(order.id).subscribe({
      next: (full) => {
        this.detailOrder.set(full);
        this.loadingDetail.set(false);
      },
      error: () => {
        this.loadingDetail.set(false);
        this.detailOrder.set(null);
      },
    });
  }

  closeDetail(): void {
    this.detailOrder.set(null);
    this.loadingDetail.set(false);
  }

  editFromDetail(): void {
    const order = this.detailOrder();
    if (!order) return;
    this.closeDetail();
    this.openEditForm(order);
  }

  openEditForm(order: ServiceOrder): void {
    this.editingOrder.set(null);
    this.loadingEdit.set(true);
    this.showForm.set(true);
    this.serviceOrderService.getServiceOrder(order.id).subscribe({
      next: (full) => {
        this.editingOrder.set(full);
        this.loadingEdit.set(false);
      },
      error: () => {
        this.loadingEdit.set(false);
        this.showForm.set(false);
      },
    });
  }

  orderProductLabels(order: ServiceOrder): string[] {
    return (order.items ?? [])
      .map(it => {
        if (it.item_type === 'part') return it.product_name ?? null;
        return it.service_type ?? null;
      })
      .filter((v): v is string => v !== null && v.trim().length > 0);
  }

  getServiceItems(order: ServiceOrder) {
    return (order.items ?? []).filter(i => i.item_type !== 'part');
  }

  getPartItems(order: ServiceOrder) {
    return (order.items ?? []).filter(i => i.item_type === 'part');
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingOrder.set(null);
  }

  onFormSubmit(payload: ServiceOrderPayload): void {
    const editing = this.editingOrder();
    if (editing) {
      this.serviceOrderService.updateServiceOrder(editing.id, payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadSummary();
          this.loadBoard();
        },
      });
    } else {
      this.serviceOrderService.createServiceOrder(payload).subscribe({
        next: () => {
          this.closeForm();
          this.loadData();
          this.loadSummary();
          this.loadBoard();
        },
      });
    }
  }

  deleteOrder(order: ServiceOrder): void {
    if (!confirm(`Supprimer l'intervention de ${order.client_record?.name || order.vehicle} ?`)) return;
    this.deletingId.set(order.id);
    this.serviceOrderService.deleteServiceOrder(order.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadData();
        this.loadSummary();
        this.loadBoard();
      },
      error: () => this.deletingId.set(null),
    });
  }

  openPayments(order: ServiceOrder): void {
    this.paymentOrder.set(order);
  }

  closePayments(): void {
    this.paymentOrder.set(null);
    this.loadData();
    this.loadSummary();
    this.loadBoard();
  }

  buildFilters(): Record<string, string> {
    const f: Record<string, string> = {
      page: String(this.currentPage()),
      per_page: String(this.perPage()),
    };
    if (this.filterSearch()) f['search'] = this.filterSearch();
    if (this.filterClientId()) f['client_id'] = String(this.filterClientId());
    if (this.filterProductId()) f['product_id'] = String(this.filterProductId());
    if (this.filterStatus()) f['status'] = this.filterStatus();
    if (this.filterPaymentStatus()) f['payment_status'] = this.filterPaymentStatus();
    if (this.filterPaymentMethod()) f['payment_method'] = this.filterPaymentMethod();
    if (this.filterCommercial()) f['commercial_id'] = this.filterCommercial();
    if (this.filterDateFrom()) f['date_from'] = this.filterDateFrom();
    if (this.filterDateTo()) f['date_to'] = this.filterDateTo();
    return f;
  }

  get pages(): number[] {
    const current = this.currentPage();
    const last = this.lastPage();
    const range: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(last, current + 2); i++) {
      range.push(i);
    }
    return range;
  }

  exportOrders(): void {
    this.isExporting.set(true);
    this.exportError.set('');
    const filters = this.buildFilters();
    delete filters['page'];
    delete filters['per_page'];
    this.serviceOrderService.exportOrders(filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `service-auto-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => {
        this.exportError.set("L'export a échoué. Veuillez réessayer.");
        this.isExporting.set(false);
      },
    });
  }

  updateOrderStatus(order: ServiceOrder, target: any): void {
    this.changeStatus(order, target.value);
  }

  changeStatus(order: ServiceOrder, newStatus: ServiceOrderStatus): void {
    if (order.status === newStatus) return;

    const oldStatus = order.status;
    order.status = newStatus;

    this.serviceOrderService.updateServiceOrder(order.id, { status: newStatus } as any).subscribe({
      next: () => {
        this.loadData();
        this.loadBoard();
      },
      error: () => {
        order.status = oldStatus;
        alert('Erreur lors de la mise à jour du statut');
      },
    });
  }

  marginPct(order: ServiceOrder): number {
    const base = Number(order.total_amount);
    if (!base) return 0;
    return (Number(order.margin) / base) * 100;
  }

  marginClass(order: ServiceOrder): string {
    const pct = this.marginPct(order);
    if (pct > 20) return 'margin-high';
    if (pct > 10) return 'margin-mid';
    return 'margin-low';
  }

  statusClass(status: ServiceOrderStatus): string {
    switch (status) {
      case 'TERMINE': return 'badge-success';
      case 'ANNULE': return 'badge-danger';
      default: return 'badge-warning';
    }
  }

  paymentClass(ps: PaymentStatus): string {
    switch (ps) {
      case 'PAYE': return 'badge-success';
      case 'PARTIEL': return 'badge-warning';
      default: return 'badge-danger';
    }
  }
}
