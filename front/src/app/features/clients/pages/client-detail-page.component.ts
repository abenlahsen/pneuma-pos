import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientService } from '../data-access/client.service';
import { ClientPaymentComponent } from '../components/client-payment/client-payment.component';
import { SalePaymentDetailComponent } from '../../sales/components/sale-payment-detail/sale-payment-detail.component';
import {
  ClientProfileResponse,
  ClientSalesHistoryRow,
  ClientStatementEntry,
  ClientStatementResponse,
  ClientPaymentRow,
} from '../models/client.model';
import { VehicleService } from '../../vehicles/data-access/vehicle.service';
import { Vehicle } from '../../vehicles/models/vehicle.model';
import { VehicleFormComponent } from '../../../shared/vehicle-form/vehicle-form.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';

/** Les quatre tranches d'ancienneté, dans l'ordre où elles se lisent. */
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

/**
 * Les vues du registre. Le gabarit en dessine quatre — Tout, En cours,
 * Paiements, Avoirs — mais il n'y en a que trois ici : l'avoir client n'existe
 * pas dans le domaine. Aucune table, aucun modèle, aucun type d'écriture ne le
 * porte ; seuls les retours fournisseur existent, et ils sont de l'autre côté.
 * Un bouton qui ne peut jamais rien trouver vaut moins que pas de bouton.
 */
export type RegisterScope = 'all' | 'open' | 'payments';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, VehicleFormComponent, ClientPaymentComponent, SalePaymentDetailComponent, IconComponent, ConfirmDeleteComponent],
  templateUrl: './client-detail-page.component.html',
  styleUrl: './client-detail-page.component.scss',
})
export class ClientDetailPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly vehicleService = inject(VehicleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);

  activeClientId: number | null = null;

  readonly loading = signal(true);
  readonly profileLoading = signal(false);
  readonly statementLoading = signal(false);
  readonly errorMessage = signal('');
  readonly statementErrorMessage = signal('');
  /**
   * Échec d'une action, par opposition à un échec de chargement : la fiche
   * reste affichée. Les deux alert() natifs qui tenaient ce rôle disparaissent
   * avec la même logique que les confirm() du §5c.
   */
  readonly actionError = signal('');

  readonly profile = signal<ClientProfileResponse | null>(null);
  readonly statement = signal<ClientStatementResponse | null>(null);

  readonly isPaymentModalOpen = signal(false);
  readonly viewingPaymentId = signal<number | null>(null);
  readonly deletingPaymentId = signal<number | null>(null);
  readonly deleting = signal(false);

  readonly vehicles = signal<Vehicle[]>([]);
  readonly showVehicleForm = signal(false);
  readonly editingVehicle = signal<Vehicle | null>(null);

  // ── Refonte 2b, 16a : les deux filtres du registre ────────────────────────
  /** Vue courante du registre — les boutons en tête. */
  readonly scope = signal<RegisterScope>('all');
  /** Tranche d'ancienneté sélectionnée, `null` quand aucune ne l'est. */
  readonly agingBucket = signal<AgingBucket | null>(null);

  /**
   * Le registre. Le serveur le construit déjà unifié — solde d'ouverture,
   * ventes, paiements, ordres de service et leurs paiements — trié par date
   * avec un solde progressif, du plus récent au plus ancien. L'écran le
   * fragmentait en trois tableaux repliables ; il le montre maintenant tel
   * qu'il est calculé.
   */
  readonly entries = computed<ClientStatementEntry[]>(() => this.statement()?.entries ?? []);

  /** Refonte 2b : l'âge de la dette et le délai réel viennent du relevé. */
  readonly aging = computed(() => this.statement()?.summary?.aging ?? null);
  readonly paymentDelay = computed(() => this.statement()?.summary?.payment_delay ?? null);

  /** Part de chaque tranche dans la dette, pour la largeur des segments. */
  agingShare(amount: number): number {
    const total = this.aging()?.total ?? 0;
    return total > 0 ? (amount / total) * 100 : 0;
  }

  readonly openInvoices = computed<ClientSalesHistoryRow[]>(() => {
    return (this.statement()?.sales ?? []).filter((sale) => (sale.balance_due ?? 0) > 0);
  });

  /** Identifiants des ventes encore dues — sert au filtre « en cours ». */
  private readonly openSaleIds = computed<Set<number>>(
    () => new Set(this.openInvoices().map((s) => s.id).filter((id): id is number => typeof id === 'number')),
  );

  /**
   * Ventes dues rangées par tranche d'ancienneté. On reproduit ici la règle du
   * serveur (ClientDebtService::aging) : l'âge se compte depuis la date de la
   * vente, et les ordres de service en sont exclus — sans quoi le total des
   * cellules ne correspondrait plus à celui de la barre.
   */
  private readonly saleIdsByBucket = computed<Record<AgingBucket, Set<number>>>(() => {
    const buckets: Record<AgingBucket, Set<number>> = {
      '0-30': new Set(), '31-60': new Set(), '61-90': new Set(), '90+': new Set(),
    };

    for (const sale of this.openInvoices()) {
      if (sale.type === 'service_order' || typeof sale.id !== 'number') continue;

      const days = this.daysSince(sale.sale_date ?? sale.created_at);
      if (days === null) continue;

      const key: AgingBucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      buckets[key].add(sale.id);
    }

    return buckets;
  });

  /** Le registre après application des deux filtres. */
  readonly visibleEntries = computed<ClientStatementEntry[]>(() => {
    const bucket = this.agingBucket();
    const ids = bucket ? this.saleIdsByBucket()[bucket] : null;
    const open = this.openSaleIds();

    return this.entries().filter((entry) => {
      // La tranche d'ancienneté retient une facture ET ce qui a été versé
      // dessus : c'est la lecture utile quand on veut relancer.
      if (ids && !(typeof entry.sale_id === 'number' && ids.has(entry.sale_id))) return false;

      switch (this.scope()) {
        case 'open':
          return typeof entry.sale_id === 'number' && open.has(entry.sale_id);
        case 'payments':
          return this.isPaymentEntry(entry);
        default:
          return true;
      }
    });
  });

  readonly paymentEntryCount = computed(() => this.entries().filter((e) => this.isPaymentEntry(e)).length);

  /** Le chiffre principal : ce que le client doit aujourd'hui. */
  readonly outstanding = computed(
    () => this.statement()?.summary?.outstanding_balance ?? this.profile()?.outstanding_balance ?? 0,
  );

  /** L'ordre de lecture des tranches, et leur libellé — le gabarit les montre en clair. */
  readonly bucketKeys: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];

  bucketLabel(bucket: AgingBucket): string {
    return bucket === '90+' ? '+90 J' : `${bucket} J`;
  }

  /**
   * Le délai réellement observé, en chiffre de contexte. Il était jusqu'ici
   * relégué dans une note de bas de bloc alors qu'il explique à lui seul
   * pourquoi un client tient un solde permanent sans être mauvais payeur.
   */
  readonly observedDelayLabel = computed(() => {
    const days = this.paymentDelay()?.observed_days;
    return typeof days === 'number' ? `${days} j` : '—';
  });

  /**
   * Le retard le plus ancien, affiché en badge dans la barre. C'est le seul
   * chiffre qui dit d'un coup d'œil si la fiche demande une relance.
   */
  readonly worstOverdueDays = computed<number | null>(() => {
    let worst = 0;

    for (const sale of this.openInvoices()) {
      if (sale.type === 'service_order') continue;
      const days = this.daysSince(sale.sale_date ?? sale.created_at);
      const accorded = this.profile()?.client?.payment_terms_days ?? 0;
      if (days !== null && days - accorded > worst) worst = days - accorded;
    }

    return worst > 0 ? worst : null;
  });

  isPaymentEntry(entry: ClientStatementEntry): boolean {
    return entry.type === 'payment' || entry.type === 'service_payment';
  }

  /** Une ligne qui porte encore une dette : elle prend le filet rouge. */
  isOverdueEntry(entry: ClientStatementEntry): boolean {
    return typeof entry.sale_id === 'number' && this.openSaleIds().has(entry.sale_id);
  }

  /** « Échue depuis 47 jours » sous la ligne, comme sur la barre d'ancienneté. */
  overdueDays(entry: ClientStatementEntry): number | null {
    if (!this.isOverdueEntry(entry) || this.isPaymentEntry(entry)) return null;
    const days = this.daysSince(entry.date);
    return days !== null && days > 0 ? days : null;
  }

  private daysSince(date: string | null | undefined): number | null {
    if (!date) return null;
    const then = new Date(date).getTime();
    if (!Number.isFinite(then)) return null;
    return Math.floor((Date.now() - then) / 86_400_000);
  }

  setScope(scope: RegisterScope): void {
    this.scope.set(scope);
  }

  /** Un second clic sur la même tranche la désélectionne. */
  toggleAgingBucket(bucket: AgingBucket): void {
    this.agingBucket.update((current) => (current === bucket ? null : bucket));
  }

  clearFilters(): void {
    this.scope.set('all');
    this.agingBucket.set(null);
  }

  readonly hasActiveFilter = computed(() => this.scope() !== 'all' || this.agingBucket() !== null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const clientId = Number(params.get('id'));

        if (!Number.isFinite(clientId) || clientId <= 0) {
          this.loading.set(false);
          this.profileLoading.set(false);
          this.statementLoading.set(false);
          this.errorMessage.set('Client sélectionné invalide.');
          this.statementErrorMessage.set('');
          this.profile.set(null);
          this.statement.set(null);
          this.activeClientId = null;
          return;
        }

        this.loadClient(clientId);
      });
  }

  deleteClient(): void {
    const name = this.profile()?.client?.name ?? 'ce client';
    const id = this.activeClientId;
    if (!id) return;

    this.pendingDelete.set({
      title: `Supprimer définitivement ${name} ?`,
      consequence: 'Son relevé, ses véhicules et son historique disparaissent avec lui.',
      detail: "La suppression échouera s'il reste des ventes ou des paiements rattachés.",
      run: () => this.performDeleteClient(id),
    });
  }

  private performDeleteClient(id: number): void {
    this.deleting.set(true);
    this.clientService.deleteClient(id).subscribe({
      next: () => this.router.navigate(['/clients']),
      error: () => {
        this.deleting.set(false);
        this.actionError.set('Impossible de supprimer ce client. Il est peut-être lié à des ventes ou des paiements.');
      },
    });
  }

  /** Refonte 2b, 6a : la modale d'édition écrite en ligne passe sur sa route. */
  openEditor(): void {
    this.router.navigate(['/clients', this.activeClientId, 'edit']);
  }

  openPaymentModal(): void {
    this.isPaymentModalOpen.set(true);
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen.set(false);
  }

  onPaymentSaved(): void {
    if (this.activeClientId) this.loadClient(this.activeClientId);
  }

  openPaymentView(payment: ClientPaymentRow): void {
    if (typeof payment.id === 'number') this.viewingPaymentId.set(payment.id);
  }

  /** Depuis le registre, où l'écriture ne porte que l'identifiant du paiement. */
  openEntryPayment(entry: ClientStatementEntry): void {
    if (typeof entry.payment_id === 'number') this.viewingPaymentId.set(entry.payment_id);
  }

  /**
   * Le relevé montre une ligne par affectation : un paiement réparti sur
   * plusieurs ventes y apparaît autant de fois. On remonte donc au paiement
   * lui-même pour que la confirmation dise la vraie conséquence — « ces
   * montants seront retirés de toutes les ventes que ce paiement couvrait ».
   */
  entryPayment(entry: ClientStatementEntry): ClientPaymentRow | null {
    if (typeof entry.payment_id !== 'number') return null;
    return (this.statement()?.payments ?? []).find((p) => p.id === entry.payment_id) ?? null;
  }

  deleteEntryPayment(entry: ClientStatementEntry): void {
    const payment = this.entryPayment(entry);
    if (payment) this.deleteStatementPayment(payment);
  }

  closePaymentView(): void {
    this.viewingPaymentId.set(null);
  }

  deleteStatementPayment(payment: ClientPaymentRow): void {
    const id = this.activeClientId;
    if (!id || typeof payment.id !== 'number') return;
    this.pendingDelete.set({
      title: 'Supprimer ce paiement ?',
      consequence: payment.multi
        ? `${payment.amount} DH seront retirés de toutes les ventes que ce paiement couvrait.`
        : `${payment.amount} DH seront retirés du règlement de la vente.`,
      detail: 'Le mouvement de trésorerie correspondant est supprimé avec lui.',
      run: () => this.performDeleteStatementPayment(id, payment),
    });
  }

  private performDeleteStatementPayment(id: number, payment: ClientPaymentRow): void {
    this.deletingPaymentId.set(payment.id);
    this.clientService.deleteClientPayment(id, payment.id).subscribe({
      next: () => {
        this.deletingPaymentId.set(null);
        this.loadClient(id);
      },
      error: () => {
        this.deletingPaymentId.set(null);
        this.actionError.set('Impossible de supprimer ce paiement.');
      },
    });
  }

  openAddVehicle(): void {
    this.editingVehicle.set(null);
    this.showVehicleForm.set(true);
  }

  editVehicle(v: Vehicle): void {
    this.editingVehicle.set(v);
    this.showVehicleForm.set(true);
  }

  onVehicleSaved(v: Vehicle): void {
    if (this.editingVehicle()) {
      this.vehicles.update(list => list.map(x => x.id === v.id ? v : x));
    } else {
      this.vehicles.update(list => [...list, v]);
    }
    this.showVehicleForm.set(false);
    this.editingVehicle.set(null);
  }

  deleteVehicle(v: Vehicle): void {
    this.pendingDelete.set({
      title: `Supprimer le véhicule ${v.plate} ?`,
      consequence: "S'il a déjà une intervention, il sera désactivé plutôt que supprimé.",
      run: () => this.performDeleteVehicle(v),
    });
  }

  private performDeleteVehicle(v: Vehicle): void {
    this.vehicleService.deleteVehicle(v.id).subscribe(result => {
      if ((result as any)?.deactivated) {
        this.vehicles.update(list => list.map(x => x.id === v.id ? { ...x, is_active: false } : x));
      } else {
        this.vehicles.update(list => list.filter(x => x.id !== v.id));
      }
    });
  }

  /** Refonte 2b, étape 4 : l'ancienne modale d'ajout de vente est remplacée par l'écran plein /sales/new, préchargé avec ce client. */
  openNewSaleForm(): void {
    this.router.navigate(['/sales/new'], { queryParams: { client_id: this.activeClientId } });
  }

  private loadClient(clientId: number): void {
    this.activeClientId = clientId;
    this.loading.set(true);
    this.profileLoading.set(true);
    this.statementLoading.set(true);
    this.errorMessage.set('');
    this.statementErrorMessage.set('');
    this.actionError.set('');
    this.profile.set(null);
    this.statement.set(null);
    this.vehicles.set([]);
    this.showVehicleForm.set(false);
    this.editingVehicle.set(null);
    this.clearFilters();

    this.vehicleService.getVehiclesForClient(clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.vehicles.set(list), error: () => {} });

    this.clientService
      .getClient(clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          if (this.activeClientId !== clientId) {
            return;
          }

          if (!this.profile()) {
            this.profile.set({
              client,
              sales_count: 0,
              total_purchased: 0,
              last_sale_date: null,
              outstanding_balance: client.opening_balance ?? 0,
              sales: [],
              sales_history: [],
              summary: {
                outstanding_balance: client.opening_balance ?? 0,
                opening_balance: client.opening_balance ?? 0,
                credit_limit: client.credit_limit ?? 0,
                total_purchased: 0,
                total_paid: 0,
                last_sale_date: null,
              },
            });
          }
          this.loading.set(false);
        },
        error: () => {
          if (this.activeClientId !== clientId) {
            return;
          }

          this.loading.set(false);
          this.profileLoading.set(false);
          this.statementLoading.set(false);
          this.errorMessage.set('Impossible de charger le profil client pour le moment.');
        },
      });

    this.clientService
      .getClientProfile(clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          if (this.activeClientId !== clientId) {
            return;
          }

          this.profile.set(profile);
          this.profileLoading.set(false);
          this.loading.set(false);
        },
        error: () => {
          if (this.activeClientId !== clientId) {
            return;
          }

          this.profileLoading.set(false);

          if (!this.profile()?.client) {
            this.loading.set(false);
            this.statementLoading.set(false);
            this.errorMessage.set('Impossible de charger le profil client pour le moment.');
          }
        },
      });

    this.clientService
      .getClientStatement(clientId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          if (this.activeClientId === clientId) {
            this.statementErrorMessage.set('Impossible de charger le relevé de compte pour le moment.');
          }

          return of(null);
        }),
      )
      .subscribe((statement) => {
        if (this.activeClientId !== clientId) {
          return;
        }

        this.statement.set(statement);
        this.statementLoading.set(false);
      });
  }
}
