import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientService } from '../data-access/client.service';
import { ClientFormComponent } from '../components/client-form/client-form.component';
import { ClientPaymentComponent } from '../components/client-payment/client-payment.component';
import { SalePaymentDetailComponent } from '../../sales/components/sale-payment-detail/sale-payment-detail.component';
import {
  ClientPayload,
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
import { SaleService } from '../../sales/data-access/sale.service';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ClientFormComponent, VehicleFormComponent, ClientPaymentComponent, SalePaymentDetailComponent, IconComponent],
  templateUrl: './client-detail-page.component.html',
  styleUrl: './client-detail-page.component.scss',
})
export class ClientDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly vehicleService = inject(VehicleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);
  private readonly saleService = inject(SaleService);

  activeClientId: number | null = null;

  readonly loading = signal(true);
  readonly profileLoading = signal(false);
  readonly statementLoading = signal(false);
  readonly errorMessage = signal('');
  readonly statementErrorMessage = signal('');
  readonly activeTab = signal<'overview' | 'statement'>('statement');

  readonly profile = signal<ClientProfileResponse | null>(null);
  readonly statement = signal<ClientStatementResponse | null>(null);

  readonly isEditModalOpen = signal(false);
  readonly isPaymentModalOpen = signal(false);
  readonly viewingPaymentId = signal<number | null>(null);
  readonly deletingPaymentId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly openInvoicesCollapsed = signal(true);
  readonly entriesCollapsed = signal(false);
  readonly paymentsCollapsed = signal(true);
  readonly deleting = signal(false);

  readonly vehicles = signal<Vehicle[]>([]);
  readonly showVehicleForm = signal(false);
  readonly editingVehicle = signal<Vehicle | null>(null);


  readonly salesHistory = computed<ClientSalesHistoryRow[]>(() => {
    const p = this.profile();
    const s = this.statement();
    return p?.sales_history ?? p?.sales ?? s?.sales ?? [];
  });

  readonly statementEntries = computed<ClientStatementEntry[]>(() => {
    return this.statement()?.entries ?? [];
  });

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

  setTab(tab: 'overview' | 'statement'): void {
    this.activeTab.set(tab);
  }

  trackByRowId(_: number, row: { id?: number | string | null }): number | string {
    return row.id ?? _;
  }

  toggleOpenInvoices(): void { this.openInvoicesCollapsed.update(v => !v); }
  toggleEntries(): void { this.entriesCollapsed.update(v => !v); }
  togglePayments(): void { this.paymentsCollapsed.update(v => !v); }

  paymentStatusClass(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PAYE') return 'badge-success';
    if (s === 'PARTIEL') return 'badge-warning';
    if (s === 'NON PAYE') return 'badge-danger';
    return 'badge-neutral';
  }

  deleteClient(): void {
    const name = this.profile()?.client?.name ?? 'ce client';
    if (!confirm(`Supprimer définitivement "${name}" ? Cette action est irréversible.`)) return;

    const id = this.activeClientId;
    if (!id) return;

    this.deleting.set(true);
    this.clientService.deleteClient(id).subscribe({
      next: () => this.router.navigate(['/clients']),
      error: () => {
        this.deleting.set(false);
        alert('Impossible de supprimer ce client. Il est peut-être lié à des ventes ou des paiements.');
      },
    });
  }

  openEditModal(): void {
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
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

  closePaymentView(): void {
    this.viewingPaymentId.set(null);
  }

  deleteStatementPayment(payment: ClientPaymentRow): void {
    const id = this.activeClientId;
    if (!id || typeof payment.id !== 'number') return;
    const warning = payment.multi
      ? 'Ce paiement couvre plusieurs ventes. Le supprimer annulera le paiement sur TOUTES ces ventes. Continuer ?'
      : 'Supprimer ce paiement ?';
    if (!confirm(warning)) return;

    this.deletingPaymentId.set(payment.id);
    this.clientService.deleteClientPayment(id, payment.id).subscribe({
      next: () => {
        this.deletingPaymentId.set(null);
        this.loadClient(id);
      },
      error: () => {
        this.deletingPaymentId.set(null);
        alert('Impossible de supprimer ce paiement.');
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
    if (!confirm(`Supprimer le véhicule ${v.plate} ?`)) return;
    this.vehicleService.deleteVehicle(v.id).subscribe(result => {
      if ((result as any)?.deactivated) {
        this.vehicles.update(list => list.map(x => x.id === v.id ? { ...x, is_active: false } : x));
      } else {
        this.vehicles.update(list => list.filter(x => x.id !== v.id));
      }
    });
  }

  formatVehicle(v: Vehicle): string {
    return this.vehicleService.formatDisplay(v);
  }

  saveClient(payload: ClientPayload): void {
    const clientId = this.activeClientId;
    if (!clientId) return;

    this.saving.set(true);
    this.clientService.updateClient(clientId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.isEditModalOpen.set(false);
        this.loadClient(clientId);
      },
      error: () => {
        this.saving.set(false);
      },
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
    this.profile.set(null);
    this.statement.set(null);
    this.vehicles.set([]);
    this.showVehicleForm.set(false);
    this.editingVehicle.set(null);
    this.activeTab.set('statement');
    this.openInvoicesCollapsed.set(true);
    this.entriesCollapsed.set(false);
    this.paymentsCollapsed.set(true);

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
