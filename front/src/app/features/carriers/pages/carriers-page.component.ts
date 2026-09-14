import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarrierService } from '../data-access/carrier.service';
import { AuthService } from '../../../core/services/auth.service';
import { Carrier, CarrierPayload, PaginatedResponse } from '../models/carrier.model';
import { CarrierFormComponent } from '../components/carrier-form/carrier-form.component';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { IconComponent } from '../../../shared/icon/icon.component';

import { describeActiveFilters } from '../../../core/utils/active-filters';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TableSkeletonComponent } from '../../../shared/table-skeleton/table-skeleton.component';
import { ErrorBannerComponent, formatErrorDetail } from '../../../shared/error-banner/error-banner.component';

@Component({
  selector: 'app-carriers-page',
  standalone: true,
  imports: [IconComponent, CommonModule, FormsModule, CarrierFormComponent, AutoRefreshControlComponent, EmptyStateComponent, TableSkeletonComponent, ErrorBannerComponent],
  templateUrl: './carriers-page.component.html',
  styleUrls: ['./carriers-page.component.scss'],
})
export class CarriersPageComponent implements OnInit, OnDestroy {
  private readonly pageHeader = inject(PageHeaderService);
  carriers = signal<Carrier[]>([]);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);
  filterSearch = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');
  loading = signal(false);
  /** Détail technique de la dernière erreur de chargement, '' si tout va bien (`3d`). */
  loadError = signal('');
  deletingCarrierId = signal<number | null>(null);
  showForm = signal(false);
  editingCarrier = signal<Carrier | null>(null);

  constructor(private service: CarrierService, public authService: AuthService) {}

  /** Titre, actions et rechargement vont dans la barre de la coquille (P1). */
  private publishHeader(): void {
    this.pageHeader.set('Transporteurs');
    this.pageHeader.setActions([
      { label: 'Nouveau transporteur', run: () => this.openAddForm(), variant: 'primary', hidden: () => !this.authService.hasPermission('create carriers') },
    ]);
    this.pageHeader.setRefresh('carriers', () => this.loadData());
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  ngOnInit(): void {
    this.publishHeader();
    this.loadData();
  }

  /** Les filtres réellement actifs, en clair — sert à expliquer un tableau vide (`3b`). */
  readonly activeFilterSummary = computed(() =>
    describeActiveFilters([
      { label: 'Recherche', value: this.filterSearch() },
    ]),
  );

  readonly hasActiveFilters = computed(() => this.activeFilterSummary() !== '');

  readonly emptyStateMessage = computed(() =>
    this.hasActiveFilters()
      ? `${this.activeFilterSummary()} Retirez les filtres pour voir davantage de transporteurs.`
      : "Aucun élément n'a encore été enregistré ici.",
  );

  loadData(): void {
    this.loadError.set('');
    this.loading.set(true);
    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 100) || 100;

    this.service
      .getCarriers({
        page: page.toString(),
        per_page: perPage.toString(),
        search: this.filterSearch(),
        sort_by: this.sortBy(),
        sort_direction: this.sortDirection(),
      })
      .subscribe({
        next: (res) => {
          const p = res as PaginatedResponse<Carrier>;
          this.carriers.set(p.data);
          this.currentPage.set(Number(p.current_page ?? 1) || 1);
          this.lastPage.set(Number(p.last_page ?? 1) || 1);
          this.total.set(Number(p.total ?? 0) || 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadData();
  }

  toggleSort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
    this.loadData();
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.sortBy.set('');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  openAddForm(): void {
    this.editingCarrier.set(null);
    this.showForm.set(true);
  }

  openEditForm(c: Carrier): void {
    this.editingCarrier.set(c);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingCarrier.set(null);
  }

  onFormSubmit(payload: CarrierPayload): void {
    const editing = this.editingCarrier();
    const obs = editing ? this.service.updateCarrier(editing.id, payload) : this.service.createCarrier(payload);
    obs.subscribe({
      next: () => {
        this.closeForm();
        this.loadData();
      },
    });
  }

  deleteCarrier(c: Carrier): void {
    if (!confirm(`Supprimer le transporteur "${c.name}" ?`)) {
      return;
    }

    this.deletingCarrierId.set(c.id);

    this.service.deleteCarrier(c.id).subscribe({
      next: () => {
        this.deletingCarrierId.set(null);
        this.loadData();
      },
      error: (err) => {
        this.loadError.set(formatErrorDetail('GET', err?.url ?? '/api/carriers', err?.status ?? 0));
        this.deletingCarrierId.set(null);
      },
    });
  }

  logout(): void {
    this.authService.logout();
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
}
