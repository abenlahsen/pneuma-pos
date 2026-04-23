import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientService } from '../data-access/client.service';
import { ClientFormComponent } from '../components/client-form/client-form.component';
import {
  ClientPayload,
  ClientProfileResponse,
  ClientSalesHistoryRow,
  ClientStatementEntry,
  ClientStatementResponse,
} from '../models/client.model';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ClientFormComponent],
  templateUrl: './client-detail-page.component.html',
  styleUrl: './client-detail-page.component.scss',
})
export class ClientDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientService = inject(ClientService);
  private readonly destroyRef = inject(DestroyRef);

  private activeClientId: number | null = null;

  readonly loading = signal(true);
  readonly profileLoading = signal(false);
  readonly statementLoading = signal(false);
  readonly errorMessage = signal('');
  readonly statementErrorMessage = signal('');
  readonly activeTab = signal<'overview' | 'statement'>('overview');

  readonly profile = signal<ClientProfileResponse | null>(null);
  readonly statement = signal<ClientStatementResponse | null>(null);

  readonly isEditModalOpen = signal(false);
  readonly saving = signal(false);

  readonly salesHistory = computed<ClientSalesHistoryRow[]>(() => {
    const p = this.profile();
    const s = this.statement();
    return p?.sales_history ?? p?.sales ?? s?.sales ?? [];
  });

  readonly statementEntries = computed<ClientStatementEntry[]>(() => {
    return this.statement()?.entries ?? [];
  });

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

  openEditModal(): void {
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
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

  private loadClient(clientId: number): void {
    this.activeClientId = clientId;
    this.loading.set(true);
    this.profileLoading.set(true);
    this.statementLoading.set(true);
    this.errorMessage.set('');
    this.statementErrorMessage.set('');
    this.profile.set(null);
    this.statement.set(null);
    this.activeTab.set('overview');

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
