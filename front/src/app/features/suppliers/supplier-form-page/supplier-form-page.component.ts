import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SupplierFormComponent } from '../components/supplier-form/supplier-form.component';
import { SupplierService } from '../data-access/supplier.service';
import { Supplier, SupplierPayload } from '../models/supplier.model';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * Refonte 2b, étape 8 — hôte routé de <app-supplier-form>, qui cesse d'être une
 * modale écrite en ligne dans deux pages. Routes : /suppliers/new et
 * /suppliers/:id/edit. Même découpage que product-form-page : la page charge
 * l'objet, câble la sortie et ramène d'où l'on vient ; toute la saisie reste
 * dans le formulaire.
 */
@Component({
  selector: 'app-supplier-form-page',
  standalone: true,
  imports: [CommonModule, SupplierFormComponent, ListErrorComponent],
  templateUrl: './supplier-form-page.component.html',
  styleUrl: './supplier-form-page.component.scss',
})
export class SupplierFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supplierService = inject(SupplierService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly supplier = signal<Supplier | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      return;
    }

    this.load(id);
  }

  load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.supplierService
      .getSupplier(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (supplier) => this.supplier.set(supplier),
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
        },
      });
  }

  /** Recharge la fiche courante après un échec — le bouton « Réessayer ». */
  retry(): void {
    const id = this.supplier()?.id ?? Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  onSave(payload: SupplierPayload): void {
    const editing = this.supplier();
    const request$ = editing
      ? this.supplierService.updateSupplier(editing.id, payload)
      : this.supplierService.createSupplier(payload);

    this.saving.set(true);
    this.saveError.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.leave(editing?.id ?? saved?.id ?? null),
      error: (err) => {
        const { cause } = describeLoadError(err);
        this.saveError.set(`Le fournisseur n'a pas pu être enregistré. ${cause}`);
      },
    });
  }

  cancel(): void {
    this.leave(this.supplier()?.id ?? null);
  }

  /**
   * On revient sur la fiche quand on éditait un supplier existant, et sur la
   * liste quand on venait d'en créer un — sauf si la création a renvoyé un
   * identifiant, auquel cas la fiche neuve est l'endroit utile.
   */
  private leave(supplierId: number | null): void {
    if (supplierId) {
      this.router.navigate(['/suppliers', supplierId]);
      return;
    }

    this.router.navigate(['/suppliers']);
  }
}
