import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ServiceOrder, ServicePayment } from '../../../core/models/service-order.model';
import { ServiceOrderService } from '../data-access/service-order.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  PartLineForm,
  ServiceOrderFormComponent,
  ServiceOrderSaveRequest,
} from '../service-order-form/service-order-form.component';
import { ServicePaymentPanelComponent } from '../service-payment-panel/service-payment-panel.component';
import { ConfirmDeleteComponent } from '../../../shared/confirm-delete/confirm-delete.component';
import { PendingDelete } from '../../../shared/confirm-delete/pending-delete';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * La page de l'intervention — refonte 2b, 12a.
 *
 * Deux routes : `/service-auto/nouveau` et `/service-auto/:id`. La page charge,
 * enregistre et confirme ; l'écran lui-même (service-order-form) ne parle pas
 * à l'API. Même partage que la fiche produit (5a) : la coque porte le
 * chargement et les erreurs, le formulaire sa géométrie et son état.
 */
@Component({
  selector: 'app-service-order-page',
  standalone: true,
  imports: [CommonModule, ServiceOrderFormComponent, ServicePaymentPanelComponent, ConfirmDeleteComponent, ListErrorComponent],
  templateUrl: './service-order-page.component.html',
  styleUrl: './service-order-page.component.scss',
})
export class ServiceOrderPageComponent implements OnInit {
  @ViewChild(ServiceOrderFormComponent) form?: ServiceOrderFormComponent;

  private readonly service = inject(ServiceOrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly order = signal<ServiceOrder | null>(null);
  readonly payments = signal<ServicePayment[]>([]);
  readonly commercials = signal<{ id: number; name: string }[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly loadErrorDetail = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly showPayments = signal(false);
  readonly pendingDelete = signal<PendingDelete | null>(null);

  private orderId: number | null = null;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.orderId = raw ? Number(raw) || null : null;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      filters: this.service.getFilters().pipe(catchError(() => of(null))),
      order: this.orderId ? this.service.getServiceOrder(this.orderId) : of(null),
    }).subscribe({
      next: ({ filters, order }) => {
        this.commercials.set(filters?.commercials ?? []);
        this.setOrder(order);
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

  private setOrder(order: ServiceOrder | null): void {
    this.order.set(order);
    this.payments.set(((order as any)?.payments ?? []) as ServicePayment[]);
  }

  /** Relit l'intervention sans recréer l'écran : les paiements et leur statut. */
  private refresh(): void {
    if (!this.orderId) return;
    this.service.getServiceOrder(this.orderId).subscribe({
      next: (order) => this.setOrder(order),
    });
  }

  get canSeeMargin(): boolean {
    return this.authService.hasPermission('view margins');
  }

  get canDelete(): boolean {
    return this.authService.hasPermission('delete service-orders');
  }

  // ── Enregistrer ────────────────────────────────────────────────────────

  onSave(request: ServiceOrderSaveRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const call = this.orderId
      ? this.service.updateServiceOrder(this.orderId, request.payload)
      : this.service.createServiceOrder(request.payload);

    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (!this.orderId) {
          // Une nouvelle intervention prend son adresse : la barre, l'état et
          // l'encaissement n'existent qu'une fois qu'elle a un numéro.
          this.router.navigate(['/service-auto', saved.id], { replaceUrl: true });
          return;
        }
        this.setOrder(saved);
        this.form?.markSaved();
        if (request.thenCollect) this.showPayments.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.message ?? "L'intervention n'a pas pu être enregistrée.");
      },
    });
  }

  // ── Les actions du pied et de la barre ─────────────────────────────────

  onCollect(): void {
    this.showPayments.set(true);
  }

  onPaymentsClosed(): void {
    this.showPayments.set(false);
    this.refresh();
  }

  /** « Annuler l'intervention » : statut ANNULE, avec la confirmation partagée (5c). */
  onCancelOrder(): void {
    const order = this.order();
    if (!order || !this.form) return;
    this.pendingDelete.set({
      title: `Annuler l'intervention ${order.id} ?`,
      consequence: "Elle quitte les colonnes de l'atelier et ses pièces reviennent en stock.",
      detail: 'Elle reste consultable dans la vue Liste, avec le filtre « Annulées », et peut être rétablie.',
      confirmLabel: "Annuler l'intervention",
      run: () => {
        this.form!.status.set('ANNULE');
        this.onSave({ payload: this.form!.buildPayload('ANNULE') });
      },
    });
  }

  onRemove(): void {
    const order = this.order();
    if (!order) return;
    this.pendingDelete.set({
      title: `Supprimer l'intervention ${order.id} ?`,
      consequence: 'Ses paiements et leurs mouvements de trésorerie sont supprimés avec elle ; ses pièces reviennent en stock.',
      run: () => {
        this.service.deleteServiceOrder(order.id).subscribe({
          next: () => this.router.navigate(['/service-orders']),
          error: (err) => this.saveError.set(err?.error?.message ?? "L'intervention n'a pas pu être supprimée."),
        });
      },
    });
  }

  runPendingDelete(reason: string): void {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    pending?.run(reason);
  }

  onPrint(): void {
    const order = this.order();
    if (order) this.router.navigate(['/documents', 'service_order', order.id, 'print']);
  }

  /**
   * « Commander la pièce » : la saisie d'achat. Elle n'a pas encore d'écran
   * plein (étape 12b) ; en attendant, la liste des achats ouvre son formulaire.
   */
  onOrderPart(_line: PartLineForm): void {
    this.router.navigate(['/achats'], { queryParams: { nouveau: 1 } });
  }

  back(): void {
    this.router.navigate(['/service-orders']);
  }
}
