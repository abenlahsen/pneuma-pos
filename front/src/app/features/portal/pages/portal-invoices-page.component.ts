import { Component } from '@angular/core';

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
export class PortalInvoicesPageComponent {
  readonly invoices: PortalInvoiceRow[] = [
    { reference: 'FA-2416', date: '02/09/2026', amount: '11 640,00 DH', status: 'En attente' },
    { reference: 'FA-2390', date: '24/08/2026', amount: '3 280,00 DH', status: 'Payée' },
    { reference: 'FA-2355', date: '10/08/2026', amount: '26 400,00 DH', status: 'Payée' },
    { reference: 'FA-2298', date: '22/07/2026', amount: '9 840,00 DH', status: 'Payée' },
  ];
}
