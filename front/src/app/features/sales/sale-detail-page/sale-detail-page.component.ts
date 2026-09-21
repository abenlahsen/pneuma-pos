import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SaleDetailComponent } from '../sale-detail/sale-detail.component';
import { PaymentPanelComponent } from '../payment-panel/payment-panel.component';
import { SaleService } from '../data-access/sale.service';
import { Sale } from '../../../core/models/sale.model';
import { AuthService } from '../../../core/services/auth.service';
import { ListContextService, Neighbours } from '../../../core/services/list-context.service';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * Refonte 2b, étape 6b — hôte routé de <app-sale-detail>, qui cesse d'être une
 * modale. Route : /sales/:id. Même découpage que product-form-page : la page
 * charge la vente, câble les sorties et ramène où il faut.
 *
 * L'encaissement reste un volet posé par-dessus la fiche : c'est une action
 * qu'on exerce contre ce que l'écran montre, et on veut garder le détail des
 * articles sous les yeux pendant qu'on répartit.
 */
@Component({
  selector: 'app-sale-detail-page',
  standalone: true,
  imports: [CommonModule, SaleDetailComponent, PaymentPanelComponent, ListErrorComponent],
  templateUrl: './sale-detail-page.component.html',
  styleUrl: './sale-detail-page.component.scss',
})
export class SaleDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly saleService = inject(SaleService);
  readonly authService = inject(AuthService);
  private readonly listContext = inject(ListContextService);

  /**
   * Précédent / Suivant. Le contexte vient de la liste, qui l'a légué au
   * service avant d'être détruite ; la fiche ne fait que l'interroger. Rien
   * quand on arrive ici par un lien direct : il n'y a alors pas d'ordre.
   */
  readonly neighbours = signal<Neighbours>({ prev: null, next: null, position: null });

  readonly loading = signal(true);
  readonly sale = signal<Sale | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly collecting = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.loadError.set('Vente introuvable.');
      return;
    }

    this.load(id);
  }

  load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.saleService
      .getSale(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (sale) => {
          this.sale.set(sale);
          this.neighbours.set(this.listContext.neighbours('sales', sale.id));
        },
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
        },
      });
  }

  retry(): void {
    const id = this.sale()?.id ?? Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  readonly canEdit = () => {
    const sale = this.sale();
    return !!sale && this.authService.hasPermission('edit sales') && sale.status !== 'ANNULE';
  };

  back(): void {
    this.router.navigate(['/sales']);
  }

  editSale(): void {
    const sale = this.sale();
    if (sale) this.router.navigate(['/sales', sale.id, 'edit']);
  }

  openCollect(): void {
    this.collecting.set(true);
  }

  /** Après un encaissement, la fiche doit redire le bon reste dû. */
  closeCollect(reload: boolean): void {
    this.collecting.set(false);
    const id = this.sale()?.id;
    if (reload && id) this.load(id);
  }

  goPrev(): void {
    const id = this.neighbours().prev;
    if (id) this.router.navigate(['/sales', id]).then(() => this.load(id));
  }

  goNext(): void {
    const id = this.neighbours().next;
    if (id) this.router.navigate(['/sales', id]).then(() => this.load(id));
  }
}
