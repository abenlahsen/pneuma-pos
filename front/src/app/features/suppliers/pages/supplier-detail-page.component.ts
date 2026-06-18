import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SupplierService } from '../data-access/supplier.service';
import { SupplierFormComponent } from '../components/supplier-form/supplier-form.component';
import { AuthService } from '../../../core/services/auth.service';
import {
  Supplier,
  SupplierPayload,
  SupplierProfileResponse,
  SupplierStatementResponse,
  SupplierStatementEntry,
  PurchaseHistoryRow,
} from '../models/supplier.model';

@Component({
  selector: 'app-supplier-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, SupplierFormComponent],
  templateUrl: './supplier-detail-page.component.html',
  styleUrl: './supplier-detail-page.component.scss',
})
export class SupplierDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supplierService = inject(SupplierService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);

  private activeId: number | null = null;

  readonly loading = signal(true);
  readonly profileLoading = signal(false);
  readonly statementLoading = signal(false);
  readonly errorMessage = signal('');
  readonly statementErrorMessage = signal('');
  readonly activeTab = signal<'overview' | 'statement'>('overview');

  readonly profile = signal<SupplierProfileResponse | null>(null);
  readonly statement = signal<SupplierStatementResponse | null>(null);

  readonly isEditModalOpen = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);

  readonly purchasesHistory = computed<PurchaseHistoryRow[]>(() =>
    this.profile()?.purchases ?? this.statement()?.purchases ?? []
  );

  readonly statementEntries = computed<SupplierStatementEntry[]>(() =>
    this.statement()?.entries ?? []
  );

  readonly openPurchases = computed<PurchaseHistoryRow[]>(() =>
    (this.statement()?.purchases ?? []).filter(p => (p.outstanding_amount ?? 0) > 0)
  );

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = Number(params.get('id'));
        if (!Number.isFinite(id) || id <= 0) {
          this.loading.set(false);
          this.errorMessage.set('Fournisseur invalide.');
          return;
        }
        this.loadSupplier(id);
      });
  }

  setTab(tab: 'overview' | 'statement'): void {
    this.activeTab.set(tab);
  }

  trackById(_: number, row: { id?: number | null }): number | string {
    return row.id ?? _;
  }

  openEditModal(): void { this.isEditModalOpen.set(true); }
  closeEditModal(): void { this.isEditModalOpen.set(false); }

  saveSupplier(payload: SupplierPayload): void {
    const id = this.activeId;
    if (!id) return;
    this.saving.set(true);
    this.supplierService.updateSupplier(id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.isEditModalOpen.set(false);
        this.loadSupplier(id);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteSupplier(): void {
    const name = this.profile()?.supplier?.name ?? 'ce fournisseur';
    if (!confirm(`Supprimer définitivement "${name}" ? Cette action est irréversible.`)) return;
    const id = this.activeId;
    if (!id) return;
    this.deleting.set(true);
    this.supplierService.deleteSupplier(id).subscribe({
      next: () => this.router.navigate(['/suppliers']),
      error: () => {
        this.deleting.set(false);
        alert('Impossible de supprimer ce fournisseur. Il est peut-être lié à des achats.');
      },
    });
  }

  paymentStatusClass(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'PAYE') return 'badge-success';
    if (s === 'PARTIEL') return 'badge-warning';
    if (s === 'NON PAYE') return 'badge-danger';
    return 'badge-neutral';
  }

  purchaseStatusClass(status: string | null | undefined): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'RECU' || s === 'TERMINE') return 'badge-success';
    if (s === 'EN COURS') return 'badge-warning';
    if (s === 'ANNULE' || s === 'RETOUR') return 'badge-danger';
    return 'badge-neutral';
  }

  private loadSupplier(id: number): void {
    this.activeId = id;
    this.loading.set(true);
    this.profileLoading.set(true);
    this.statementLoading.set(true);
    this.errorMessage.set('');
    this.statementErrorMessage.set('');
    this.profile.set(null);
    this.statement.set(null);
    this.activeTab.set('overview');
    this.isEditModalOpen.set(false);

    this.supplierService.getSupplier(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: supplier => {
          if (this.activeId !== id) return;
          if (!this.profile()) {
            this.profile.set({
              supplier,
              purchases_count: 0,
              total_purchased: 0,
              last_purchase_date: null,
              outstanding_balance: 0,
              purchases: [],
            });
          }
          this.loading.set(false);
        },
        error: () => {
          if (this.activeId !== id) return;
          this.loading.set(false);
          this.profileLoading.set(false);
          this.statementLoading.set(false);
          this.errorMessage.set('Impossible de charger le profil fournisseur.');
        },
      });

    this.supplierService.getSupplierProfile(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: profile => {
          if (this.activeId !== id) return;
          this.profile.set(profile);
          this.profileLoading.set(false);
          this.loading.set(false);
        },
        error: () => {
          if (this.activeId !== id) return;
          this.profileLoading.set(false);
          if (!this.profile()?.supplier) {
            this.loading.set(false);
            this.statementLoading.set(false);
            this.errorMessage.set('Impossible de charger le profil fournisseur.');
          }
        },
      });

    this.supplierService.getSupplierStatement(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          if (this.activeId === id) {
            this.statementErrorMessage.set('Impossible de charger le relevé.');
          }
          return of(null);
        })
      )
      .subscribe(stmt => {
        if (this.activeId !== id) return;
        this.statement.set(stmt);
        this.statementLoading.set(false);
      });
  }
}
