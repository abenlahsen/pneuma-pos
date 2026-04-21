import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientService } from '../data-access/client.service';
import {
  ClientProfileResponse,
  ClientSalesHistoryRow,
  ClientStatementEntry,
  ClientStatementResponse,
} from '../models/client.model';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-detail-page.component.html',
  styleUrl: './client-detail-page.component.scss',
})
export class ClientDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clientService = inject(ClientService);
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  errorMessage = '';
  activeTab: 'overview' | 'statement' = 'overview';

  profile: ClientProfileResponse | null = null;
  statement: ClientStatementResponse | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const clientId = Number(params.get('id'));

        if (!Number.isFinite(clientId) || clientId <= 0) {
          this.loading = false;
          this.errorMessage = 'Invalid client selected.';
          return;
        }

        this.loadClient(clientId);
      });
  }

  get salesHistory(): ClientSalesHistoryRow[] {
    return this.profile?.sales_history ?? this.profile?.sales ?? this.statement?.sales ?? [];
  }

  get statementEntries(): ClientStatementEntry[] {
    return this.statement?.entries ?? [];
  }

  get openInvoices(): ClientSalesHistoryRow[] {
    return (this.statement?.sales ?? []).filter((sale) => (sale.balance_due ?? 0) > 0);
  }

  setTab(tab: 'overview' | 'statement'): void {
    this.activeTab = tab;
  }

  trackByRowId(_: number, row: { id?: number | string | null }): number | string {
    return row.id ?? _;
  }

  private loadClient(clientId: number): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      profile: this.clientService.getClientProfile(clientId),
      statement: this.clientService.getClientStatement(clientId).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profile, statement }) => {
          this.profile = profile;
          this.statement = statement;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'Unable to load the client profile right now.';
        },
      });
  }
}