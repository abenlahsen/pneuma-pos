import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ClientFormComponent } from '../components/client-form/client-form.component';
import { ClientService } from '../data-access/client.service';
import { Client, ClientPayload } from '../models/client.model';
import { ListErrorComponent, describeLoadError } from '../../../shared/list-state';

/**
 * Refonte 2b, étape 6a — hôte routé de <app-client-form>, qui cesse d'être une
 * modale écrite en ligne dans deux pages. Routes : /clients/new et
 * /clients/:id/edit. Même découpage que product-form-page : la page charge
 * l'objet, câble la sortie et ramène d'où l'on vient ; toute la saisie reste
 * dans le formulaire.
 */
@Component({
  selector: 'app-client-form-page',
  standalone: true,
  imports: [CommonModule, ClientFormComponent, ListErrorComponent],
  templateUrl: './client-form-page.component.html',
  styleUrl: './client-form-page.component.scss',
})
export class ClientFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly client = signal<Client | null>(null);
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

    this.clientService
      .getClient(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (client) => this.client.set(client),
        error: (err) => {
          const { cause, detail } = describeLoadError(err);
          this.loadError.set(cause);
          this.loadErrorDetail.set(detail);
        },
      });
  }

  /** Recharge la fiche courante après un échec — le bouton « Réessayer ». */
  retry(): void {
    const id = this.client()?.id ?? Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isFinite(id) && id > 0) this.load(id);
  }

  onSave(payload: ClientPayload): void {
    const editing = this.client();
    const request$ = editing
      ? this.clientService.updateClient(editing.id, payload)
      : this.clientService.createClient(payload);

    this.saving.set(true);
    this.saveError.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.leave(editing?.id ?? saved?.id ?? null),
      error: (err) => {
        const { cause } = describeLoadError(err);
        this.saveError.set(`Le client n'a pas pu être enregistré. ${cause}`);
      },
    });
  }

  cancel(): void {
    this.leave(this.client()?.id ?? null);
  }

  /**
   * On revient sur la fiche quand on éditait un client existant, et sur la
   * liste quand on venait d'en créer un — sauf si la création a renvoyé un
   * identifiant, auquel cas la fiche neuve est l'endroit utile.
   */
  private leave(clientId: number | null): void {
    if (clientId) {
      this.router.navigate(['/clients', clientId]);
      return;
    }

    this.router.navigate(['/clients']);
  }
}
