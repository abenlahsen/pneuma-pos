import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { PageHeaderService } from '../../../core/services/page-header.service';

interface PortalInvoiceRow {
  reference: string;
  date: string;
  amount: string;
  status: 'Payée' | 'En attente';
}

/** Étape 5 — coquille de démonstration, données d'exemple statiques. Pas de
 *  maquette dédiée dans le handoff : réutilise le vocabulaire visuel de
 *  "Mes commandes" (portal-orders-page). */
@Component({
  selector: 'app-portal-invoices-page',
  standalone: true,
  templateUrl: './portal-invoices-page.component.html',
  styleUrl: './portal-invoices-page.component.scss',
})
export class PortalInvoicesPageComponent implements OnInit, OnDestroy {
  private readonly pageHeader = inject(PageHeaderService);

  /** Le titre va dans la barre de la coquille, comme les ecrans internes : le
   *  portail est le dernier endroit ou laisser deux motifs concurrents. */
  ngOnInit(): void {
    this.pageHeader.set('Factures', 'Transport Chaouia · ', 'Compte 1042');
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }

  readonly invoices: PortalInvoiceRow[] = [
    { reference: 'FA-2416', date: '02/09/2026', amount: '11 640,00 DH', status: 'En attente' },
    { reference: 'FA-2390', date: '24/08/2026', amount: '3 280,00 DH', status: 'Payée' },
    { reference: 'FA-2355', date: '10/08/2026', amount: '26 400,00 DH', status: 'Payée' },
    { reference: 'FA-2298', date: '22/07/2026', amount: '9 840,00 DH', status: 'Payée' },
  ];
}
