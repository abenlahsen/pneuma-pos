import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { SaleFormComponent } from '../sale-form/sale-form.component';
import { SaleService } from '../data-access/sale.service';
import { Sale, SalePayload } from '../../../core/models/sale.model';
import { CarrierService } from '../../carriers/data-access/carrier.service';
import { Carrier } from '../../carriers/models/carrier.model';
import { PartnerService } from '../../partners/data-access/partner.service';
import { Partner } from '../../partners/models/partner.model';
import { ClientService } from '../../clients/data-access/client.service';
import { Client } from '../../clients/models/client.model';
import { ManagedUser } from '../../../core/models/user-manage.model';

/**
 * Refonte 2b, étape 4 — hôte routé de <app-sale-form> (écran plein deux
 * volets), remplace la modale ouverte depuis sales-page.component. Routes :
 * /sales/new (création, avec ?client_id= optionnel pour préremplir depuis
 * la fiche client) et /sales/:id/edit (modification).
 */
@Component({
  selector: 'app-sale-form-page',
  standalone: true,
  imports: [CommonModule, SaleFormComponent],
  templateUrl: './sale-form-page.component.html',
  styleUrl: './sale-form-page.component.scss',
})
export class SaleFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly saleService = inject(SaleService);
  private readonly carrierService = inject(CarrierService);
  private readonly partnerService = inject(PartnerService);
  private readonly clientService = inject(ClientService);

  loading = signal(true);
  saving = signal(false);
  sale = signal<Sale | null>(null);
  preselectedClient = signal<Client | null>(null);

  carriers = signal<Carrier[]>([]);
  partners = signal<Partner[]>([]);
  commercials = signal<ManagedUser[]>([]);

  /** Où revenir sur "Annuler" ou après enregistrement — la fiche client si on en vient, la liste des ventes sinon. */
  private returnUrl = '/sales';

  ngOnInit(): void {
    this.carrierService.getCarriers({ all: true }).subscribe({
      next: (res: any) => this.carriers.set(Array.isArray(res) ? res : res.data),
    });
    this.partnerService.getPartners({ all: true }).subscribe({
      next: (res: any) => this.partners.set(Array.isArray(res) ? res : res.data),
    });
    this.saleService.getFilters().subscribe({
      next: (filters) => this.commercials.set(filters.commercials as unknown as ManagedUser[]),
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    const clientId = Number(this.route.snapshot.queryParamMap.get('client_id'));

    if (id) {
      this.saleService.getSale(id).subscribe({
        next: (sale) => {
          this.sale.set(sale);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.router.navigateByUrl('/sales');
        },
      });
      return;
    }

    if (clientId) {
      this.returnUrl = `/clients/${clientId}`;
      this.clientService.getClient(clientId).subscribe({
        next: (client) => {
          this.preselectedClient.set(client);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    this.loading.set(false);
  }

  onCancel(): void {
    this.router.navigateByUrl(this.returnUrl);
  }

  onSave(payload: SalePayload): void {
    this.persist(payload).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
    });
  }

  /** "Valider et encaisser" : enregistre puis enchaîne sur le panneau de paiement de la liste des ventes, au lieu de revenir simplement à la liste. */
  onSaveAndPay(payload: SalePayload): void {
    this.persist(payload).subscribe({
      next: (saved) => this.router.navigate(['/sales'], { queryParams: { pay: saved.id } }),
    });
  }

  private persist(payload: SalePayload) {
    this.saving.set(true);
    const current = this.sale();
    const request$ = current
      ? this.saleService.updateSale(current.id, payload)
      : this.saleService.createSale(payload);

    return request$.pipe(finalize(() => this.saving.set(false)));
  }
}
