import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PurchaseDetailComponent } from '../purchase-detail/purchase-detail.component';
import { PurchasePaymentsComponent } from '../purchase-payments/purchase-payments.component';
import { PurchaseReturnComponent } from '../purchase-return/purchase-return.component';
import { PurchaseService } from '../data-access/purchase.service';
import { Purchase } from '../../../core/models/purchase.model';
import { AuthService } from '../../../core/services/auth.service';
import { ListContextService, Neighbours } from '../../../core/services/list-context.service';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * Refonte 2b, étape 6b — hôte routé de <app-purchase-detail>. Route :
 * /achats/:id. Même découpage que sale-detail-page ; le règlement et le retour
 * fournisseur restent des surfaces posées par-dessus la fiche, parce qu'on
 * veut garder les articles sous les yeux en les remplissant.
 */
@Component({
  selector: 'app-purchase-detail-page',
  standalone: true,
  imports: [CommonModule, PurchaseDetailComponent, PurchasePaymentsComponent, PurchaseReturnComponent, ListErrorComponent],
  templateUrl: './purchase-detail-page.component.html',
  styleUrl: './purchase-detail-page.component.scss',
})
export class PurchaseDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly purchaseService = inject(PurchaseService);
  readonly authService = inject(AuthService);
  private readonly listContext = inject(ListContextService);

  /**
   * Précédent / Suivant. Le contexte vient de la liste, qui l'a légué au
   * service avant d'être détruite ; la fiche ne fait que l'interroger. Rien
   * quand on arrive ici par un lien direct : il n'y a alors pas d'ordre.
   */
  readonly neighbours = signal<Neighbours>({ prev: null, next: null, position: null });

  readonly loading = signal(true);
  readonly purchase = signal<Purchase | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly settling = signal(false);
  readonly returning = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.loadError.set('Achat introuvable.');
      return;
    }

    this.load(id);
  }

  load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.purchaseService
      .getPurchase(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (purchase) => {
          this.purchase.set(purchase);
          this.neighbours.set(this.listContext.neighbours('purchases', purchase.id));
        },
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
        },
      });
  }

  retry(): void {
    const id = this.purchase()?.id ?? Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  canEdit(): boolean {
    const purchase = this.purchase();
    return !!purchase && this.authService.hasPermission('edit purchases') && purchase.status !== 'ANNULE';
  }

  canReturn(): boolean {
    const purchase = this.purchase();
    return !!purchase && this.authService.hasPermission('edit purchases') && purchase.status === 'RECU';
  }

  back(): void {
    this.router.navigate(['/achats']);
  }

  /**
   * L'achat n'a pas encore d'écran plein de saisie — il se modifie dans le
   * formulaire de la liste. On y renvoie avec l'identifiant, plutôt que
   * d'inventer une route qui n'existe pas.
   */
  editPurchase(): void {
    const purchase = this.purchase();
    if (purchase) this.router.navigate(['/achats'], { queryParams: { edit: purchase.id } });
  }

  /** Un retour comme un règlement change le dû : la fiche se recharge. */
  reload(): void {
    const id = this.purchase()?.id;
    if (id) this.load(id);
  }

  closeSettle(reload: boolean): void {
    this.settling.set(false);
    if (reload) this.reload();
  }

  closeReturn(reload: boolean): void {
    this.returning.set(false);
    if (reload) this.reload();
  }

  goPrev(): void {
    const id = this.neighbours().prev;
    if (id) this.router.navigate(['/achats', id]).then(() => this.load(id));
  }

  goNext(): void {
    const id = this.neighbours().next;
    if (id) this.router.navigate(['/achats', id]).then(() => this.load(id));
  }
}
