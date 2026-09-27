import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { PurchaseService } from '../data-access/purchase.service';
import { Purchase } from '../models/purchase.model';
import { PurchaseFormComponent, PurchaseSaveRequest } from '../purchase-form/purchase-form.component';
import { PurchasePaymentsComponent } from '../purchase-payments/purchase-payments.component';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * La page de la saisie d'achat — refonte 2b, 12b.
 *
 * Deux routes : `/achats/nouveau` et `/achats/:id/modifier`. La page charge et
 * enregistre ; la saisie (purchase-form) ne parle pas à l'API. Même partage
 * que la fiche produit et l'intervention.
 */
@Component({
  selector: 'app-purchase-form-page',
  standalone: true,
  imports: [CommonModule, PurchaseFormComponent, PurchasePaymentsComponent, ListErrorComponent],
  template: `
    <div class="pfp-shell">
      <p class="pfp-loading" *ngIf="loading()">Chargement de l'achat…</p>

      <app-list-error
        *ngIf="loadError()"
        title="L'achat n'a pas pu être chargé."
        [cause]="loadError()!"
        [detail]="loadErrorDetail()"
        (retry)="load()" />

      @if (!loading() && !loadError()) {
        <app-purchase-form
          [purchase]="purchase()"
          [busy]="saving()"
          [errorMessage]="saveError()"
          (save)="onSave($event)"
          (cancel)="back()" />
      }
    </div>

    <!-- « Payé maintenant » : le volet de règlement, par-dessus l'achat enregistré. -->
    @if (payingPurchase(); as p) {
      <app-purchase-payments [purchase]="$any(p)" (closed)="onPaymentsClosed()" />
    }
  `,
  styles: [`
    .pfp-shell { display: block; }
    .pfp-loading { margin: 0; padding: 2rem 1.25rem; font-size: 12.5px; color: #4a5c75; }
  `],
})
export class PurchaseFormPageComponent implements OnInit {
  private readonly service = inject(PurchaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly purchase = signal<Purchase | null>(null);
  readonly payingPurchase = signal<Purchase | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  private purchaseId: number | null = null;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.purchaseId = raw ? Number(raw) || null : null;
    this.load();
  }

  load(): void {
    if (!this.purchaseId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getPurchase(this.purchaseId).subscribe({
      next: (p) => {
        this.purchase.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        const { cause, detail } = describeLoadError(err);
        this.loadError.set(cause);
        this.loadErrorDetail.set(detail);
        this.loading.set(false);
      },
    });
  }

  /**
   * Enregistre. L'API crée toujours un achat « En cours » et ignore le statut
   * envoyé : une réception « Reçue » passe donc par un second appel, le
   * changement de statut, une fois l'achat créé.
   */
  onSave(request: PurchaseSaveRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const save$ = this.purchaseId
      ? this.service.updatePurchase(this.purchaseId, request.payload)
      : this.service.createPurchase(request.payload).pipe(
          switchMap(created => request.reception === 'received'
            ? this.service.patchStatus(created.id, 'RECU').pipe(
                switchMap(() => of(created)),
                // L'achat existe : un échec du statut ne doit pas le faire oublier.
                catchError(() => of(created)),
              )
            : of(created)),
        );

    save$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (request.payNow) {
          this.payingPurchase.set(saved);
          return;
        }
        this.router.navigate(['/achats', saved.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.message ?? "L'achat n'a pas pu être enregistré.");
      },
    });
  }

  /** Le règlement fait, on arrive sur la fiche de l'achat. */
  onPaymentsClosed(): void {
    const p = this.payingPurchase();
    this.payingPurchase.set(null);
    if (p) this.router.navigate(['/achats', p.id]);
  }

  back(): void {
    if (this.purchaseId) this.router.navigate(['/achats', this.purchaseId]);
    else this.router.navigate(['/achats']);
  }
}
