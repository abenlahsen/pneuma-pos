import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientFormComponent } from '../components/client-form/client-form.component';
import { ClientService } from '../data-access/client.service';
import { Client, ClientFilters, ClientPayload } from '../models/client.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { CityService } from '../../../core/services/city.service';

@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientFormComponent, AutoRefreshControlComponent],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);
  private readonly cityService = inject(CityService);

  readonly clients = signal<Client[]>([]);
  readonly currentPage = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly perPage = signal(100);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingClientId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly cities = signal<string[]>([]);

  readonly isModalOpen = signal(false);
  readonly selectedClient = signal<Client | null>(null);

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
        },
        error: () => {
          this.errorMessage.set('Impossible de charger les clients pour le moment.');
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

  openCreateModal(): void {
    this.selectedClient.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(client: Client): void {
    this.selectedClient.set(client);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedClient.set(null);
  }

  saveClient(payload: ClientPayload): void {
    const selectedClient = this.selectedClient();
    const request$ = selectedClient
      ? this.clientService.updateClient(selectedClient.id, payload)
      : this.clientService.createClient(payload);

    this.saving.set(true);
    this.errorMessage.set('');

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadClients();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set(
          selectedClient
            ? 'Impossible de modifier le client pour le moment.'
            : 'Impossible de créer le client pour le moment.',
        );
      },
    });
  }

  deleteClient(client: Client): void {
    const confirmed = window.confirm(`Supprimer le client "${client.name}" ?`);

    if (!confirmed) {
      return;
    }

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
