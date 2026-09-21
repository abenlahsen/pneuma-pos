import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientService } from '../data-access/client.service';
import { Client, ClientFilters } from '../models/client.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { CityService } from '../../../core/services/city.service';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoRefreshControlComponent, IconComponent, RouterLink, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, ConfirmDeleteComponent],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);
  private readonly cityService = inject(CityService);

  readonly clients = signal<Client[]>([]);
  readonly currentPage = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly perPage = signal(100);
  readonly loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Refonte 2b, règle 3 du motif de ligne : ce qui qualifie sans être trié
   * descend sous le nom plutôt que d'occuper une colonne. L'adresse
   * électronique y figure aussi, quand elle existe — aucun des 799 clients de
   * la base n'en a, mais le formulaire la propose.
   */
  subLineFor(client: Client): string {
    return [client.city, client.phone, client.email].filter(Boolean).join(' · ') || '—';
  }

  /**
   * Le gabarit de liste veut un total en pied. Celui de la sélection entière
   * n'existe pas : l'API des clients ne renvoie aucun résumé. On annonce donc
   * ce qu'on sait vraiment — le cumul de la page affichée — et on le dit dans
   * le libellé.
   */
  readonly pageCreditLimit = computed(() =>
    this.clients().reduce((sum, client) => sum + (client.credit_limit ?? 0), 0)
  );

  /**
   * Méthode et non `computed()` : sur cet écran les filtres vivent dans un
   * objet simple (`this.filters`), muté par `[(ngModel)]`. Un `computed()` qui
   * ne lit aucun signal ne se recalculerait jamais.
   */
  activeFilters(): ActiveFilter[] {
    const applied: ActiveFilter[] = [];
    const drop = (label: string, apply: () => void) => {
      applied.push({
        label,
        clear: () => {
          apply();
          this.currentPage.set(1);
          this.loadClients();
        },
      });
    };

    if (this.filters.search) drop(`recherche « ${this.filters.search} »`, () => (this.filters.search = ''));
    if (this.filters.city) drop(`ville ${this.filters.city}`, () => (this.filters.city = ''));
    if (this.filters.category) drop(`catégorie ${this.filters.category}`, () => (this.filters.category = ''));
    if (this.filters.status && this.filters.status !== 'all') {
      drop(this.filters.status === 'active' ? 'actifs uniquement' : 'inactifs uniquement', () => (this.filters.status = 'all'));
    }

    return applied;
  }
  readonly deletingClientId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly cities = signal<string[]>([]);
  readonly isExporting = signal(false);
  readonly exportError = signal('');

  filters: ClientFilters = {
    search: '',
    city: '',
    category: '',
    status: 'all',
    page: 1,
    per_page: 100,
  };

  readonly activeClientsCount = computed(() =>
    this.clients().filter((client) => client.is_active !== false).length,
  );

  readonly inactiveClientsCount = computed(() =>
    this.clients().filter((client) => client.is_active === false).length,
  );

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities.set(cities));
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 100) || 100;

    this.clientService
      .getClientsResponse({
        ...this.filters,
        page,
        per_page: perPage,
      })
      .subscribe({
        next: (response) => {
          this.clients.set(response.data ?? []);
          this.currentPage.set(Number(response.current_page ?? 1) || 1);
          this.lastPage.set(Number(response.last_page ?? 1) || 1);
          this.total.set(Number(response.total ?? 0) || 0);
          this.perPage.set(Number(response.per_page ?? perPage) || perPage);
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

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadClients();
  }

  clearFilters(): void {
    this.currentPage.set(1);
    this.perPage.set(100);
    this.filters = {
      search: '',
      city: '',
      category: '',
      status: 'all',
      page: 1,
      per_page: 100,
    };

    this.loadClients();
  }

  /**
   * Refonte 2b, 6a : la fiche client porte douze champs, le §5b la renvoie donc
   * hors de la modale. Les deux entrées ouvrent l'éditeur 15a sur sa route.
   */
  openCreateModal(): void {
    this.router.navigate(['/clients/new']);
  }

  openEditModal(client: Client): void {
    this.router.navigate(['/clients', client.id, 'edit']);
  }

  deleteClient(client: Client): void {
    this.pendingDelete.set({
      title: `Supprimer le client « ${client.name} » ?`,
      consequence: 'Son relevé et son historique disparaissent avec lui.',
      detail: "La suppression échouera s'il reste des ventes ou des paiements rattachés.",
      run: () => this.performDeleteClient(client),
    });
  }

  private performDeleteClient(client: Client): void {
    this.deletingClientId.set(client.id);
    this.errorMessage.set('');

    this.clientService.deleteClient(client.id).subscribe({
      next: () => {
        this.deletingClientId.set(null);
        this.loadClients();
      },
      error: () => {
        this.deletingClientId.set(null);
        this.errorMessage.set('Impossible de supprimer le client pour le moment.');
      },
    });
  }

  viewClient(client: Client): void {
    this.router.navigate(['/clients', client.id]);
  }

  exportClients(): void {
    this.isExporting.set(true);
    this.exportError.set('');

    this.clientService.exportClients(this.filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
      },
      error: () => {
        this.exportError.set("L'export des clients a échoué. Veuillez réessayer.");
        this.isExporting.set(false);
      },
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadClients();
    }
  }

  get pages(): number[] {
    const total = this.lastPage();
    const current = this.currentPage();
    const pages: number[] = [];

    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      pages.push(i);
    }

    return pages;
  }

  trackByClientId(_: number, client: Client): number {
    return client.id;
  }
}
