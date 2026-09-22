import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupplierService } from '../data-access/supplier.service';
import { AuthService } from '../../../core/services/auth.service';
import { Supplier, PaginatedResponse, SupplierUnpaidRow } from '../models/supplier.model';
import { AutoRefreshControlComponent } from '../../../shared/auto-refresh-control/auto-refresh-control.component';
import { SortIconComponent } from '../../../shared/icon/sort-icon.component';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';

import {
  ActiveFilter,
  ListEmptyComponent,
  ListErrorComponent,
  RowLockComponent,
  SkeletonRowComponent,
  describeLoadError,
} from '../../../shared/list-state';

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoRefreshControlComponent, SortIconComponent, IconComponent, SkeletonRowComponent, ListEmptyComponent, ListErrorComponent, RowLockComponent, ConfirmDeleteComponent],
  templateUrl: './suppliers-page.component.html',
  styleUrls: ['./suppliers-page.component.scss'],
})
export class SuppliersPageComponent implements OnInit {

  // ── Suppression : confirmation 15c au lieu d'un confirm() natif ───────────
  readonly pendingDelete = signal<PendingDelete | null>(null);

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }
  suppliers = signal<Supplier[]>([]);

  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  perPage = signal(100);

  filterSearch = signal('');
  sortBy = signal('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  loading = signal(false);

  // ── Refonte 2b, §14c : les quatre états manquants ─────────────────────────
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly lastLoadedAt = signal<Date | null>(null);

  /**
   * Règle 3 du motif de ligne : contact et téléphone qualifient le fournisseur
   * sans qu'on trie dessus. Ils tenaient deux colonnes pour des valeurs
   * présentes chez 17 % et 21 % des fournisseurs.
   */
  subLineFor(supplier: Supplier): string {
    return [supplier.contact_person, supplier.phone].filter(Boolean).join(' · ') || '—';
  }

  /**
   * Le reste dû par fournisseur était déjà chargé pour le tableau d'impayés en
   * haut de page, mais ne rejoignait jamais la ligne du fournisseur concerné —
   * il fallait lire deux tableaux et les recouper de tête.
   */
  unpaidFor(supplier: Supplier): number {
    return this.unpaidBySupplier().find((row) => row.supplier_id === supplier.id)?.total_unpaid ?? 0;
  }

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const applied: ActiveFilter[] = [];
    const drop = (label: string, apply: () => void) => {
      applied.push({
        label,
        clear: () => {
          apply();
          this.currentPage.set(1);
          this.loadData();
        },
      });
    };

    if (this.filterSearch()) drop(`recherche « ${this.filterSearch()} »`, () => this.filterSearch.set(''));

    return applied;
  });

  unpaidBySupplier = signal<SupplierUnpaidRow[]>([]);
  loadingUnpaid = signal(false);

  unpaidTotals = computed(() =>
    this.unpaidBySupplier().reduce(
      (acc, row) => ({
        total_unpaid: acc.total_unpaid + row.total_unpaid,
        unpaid_with_invoice: acc.unpaid_with_invoice + row.unpaid_with_invoice,
        unpaid_without_invoice: acc.unpaid_without_invoice + row.unpaid_without_invoice,
      }),
      { total_unpaid: 0, unpaid_with_invoice: 0, unpaid_without_invoice: 0 },
    )
  );

  constructor(
    private supplierService: SupplierService,
    public authService: AuthService,
    private router: Router,
  ) {}

  viewSupplier(supplier: Supplier): void {
    this.router.navigate(['/suppliers', supplier.id]);
  }

  viewSupplierById(id: number | null): void {
    if (id) {
      this.router.navigate(['/suppliers', id]);
    }
  }

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.loadData();
    this.loadUnpaidSummary();
  }

  loadUnpaidSummary(): void {
    this.loadingUnpaid.set(true);
    this.supplierService.getUnpaidSummary().subscribe({
      next: (summary) => {
        this.unpaidBySupplier.set(summary.rows);
        this.loadingUnpaid.set(false);
      },
      error: () => this.loadingUnpaid.set(false),
    });
  }

  loadData(): void {
    this.loading.set(true);
    const page = Number(this.currentPage() ?? 1) || 1;
    const perPage = Number(this.perPage() ?? 100) || 100;

    const filters = {
      page: page.toString(),
      per_page: perPage.toString(),
      search: this.filterSearch(),
      sort_by: this.sortBy(),
      sort_direction: this.sortDirection(),
    };

    this.supplierService.getSuppliers(filters).subscribe({
      next: (response) => {
        const paginated = response as PaginatedResponse<Supplier>;
        this.suppliers.set(paginated.data);
        this.currentPage.set(Number(paginated.current_page ?? 1) || 1);
        this.lastPage.set(Number(paginated.last_page ?? 1) || 1);
        this.total.set(Number(paginated.total ?? 0) || 0);
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

  /**
   * Refonte 2b : la fiche fournisseur a son éditeur routé, comme la fiche
   * client. Les deux entrées y conduisent au lieu d'ouvrir une modale.
   */
  openAddForm(): void {
    this.router.navigate(['/suppliers/new']);
  }

  openEditForm(supplier: Supplier): void {
    this.router.navigate(['/suppliers', supplier.id, 'edit']);
  }


  deleteSupplier(supplier: Supplier): void {
    this.pendingDelete.set({
      title: `Supprimer le fournisseur « ${supplier.name} » ?`,
      consequence: this.unpaidFor(supplier) > 0
        ? `Il reste ${this.unpaidFor(supplier)} DH dus à ce fournisseur.`
        : 'Aucun montant ne lui est dû actuellement.',
      detail: "La suppression échouera s'il reste des achats rattachés.",
      run: () => {
        this.supplierService.deleteSupplier(supplier.id).subscribe({
          next: () => this.loadData(),
        });
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
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
