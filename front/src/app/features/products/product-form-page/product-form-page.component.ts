import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ProductFormComponent } from '../product-form/product-form.component';
import { ProductService } from '../data-access/product.service';
import { Product, ProductPayload } from '../models/product.model';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * Refonte 2b, étape 5a — hôte routé de <app-product-form>, qui cesse d'être
 * une modale. Routes : /products/new et /products/:id/edit. Même découpage que
 * sale-form-page : la page ne fait que charger l'objet, câbler la sortie et
 * ramener où il faut ; toute la logique de saisie reste dans le formulaire.
 */
@Component({
  selector: 'app-product-form-page',
  standalone: true,
  imports: [CommonModule, ProductFormComponent, ListErrorComponent],
  templateUrl: './product-form-page.component.html',
  styleUrl: './product-form-page.component.scss',
})
export class ProductFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly product = signal<Product | null>(null);
  readonly brands = signal<{ id: number; name: string }[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  ngOnInit(): void {
    this.productService.getFilters().subscribe({
      next: (filters) => this.brands.set(filters.brands ?? []),
    });

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

    this.productService
      .getProduct(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (product) => this.product.set(product),
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
        },
      });
  }

  /** Recharge la fiche courante après un échec — le bouton « Réessayer ». */
  retry(): void {
    const id = this.product()?.id ?? Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  onSave(payload: ProductPayload): void {
    this.persist(payload, () => this.router.navigate(['/products']));
  }

  /**
   * « Enregistrer et nouveau » : on repart sur une fiche vierge. Le composant
   * étant réutilisé à l'identique par le routeur, on force sa reconstruction
   * en passant par la liste, sinon le formulaire garderait l'objet précédent.
   */
  onSaveAndNew(payload: ProductPayload): void {
    this.persist(payload, () =>
      this.router
        .navigateByUrl('/products', { skipLocationChange: true })
        .then(() => this.router.navigate(['/products/new'])),
    );
  }

  cancel(): void {
    this.router.navigate(['/products']);
  }

  private persist(payload: ProductPayload, onDone: () => void): void {
    const editing = this.product();
    const request$ = editing
      ? this.productService.updateProduct(editing.id, payload)
      : this.productService.createProduct(payload);

    this.saving.set(true);
    this.saveError.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => onDone(),
      error: (err) => {
        const { cause } = describeLoadError(err);
        this.saveError.set(`Le produit n'a pas pu être enregistré. ${cause}`);
      },
    });
  }
}
