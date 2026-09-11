import { Component } from '@angular/core';

interface PortalQuoteRow {
  reference: string;
  date: string;
  subject: string;
  amount: string;
  status: 'En attente' | 'Accepté' | 'Expiré';
}

/** Étape 5 — coquille de démonstration, données d'exemple statiques. Pas de
 *  maquette dédiée dans le handoff : réutilise le vocabulaire visuel de
 *  "Mes commandes" (portal-orders-page). */
@Component({
  selector: 'app-portal-quotes-page',
  standalone: true,
  templateUrl: './portal-quotes-page.component.html',
  styleUrl: './portal-quotes-page.component.scss',
})
export class PortalQuotesPageComponent {
  readonly quotes: PortalQuoteRow[] = [
    { reference: 'DEV-0142', date: '05/09/2026', subject: '4 pneus 205/55R16 + montage', amount: '12 480,00 DH', status: 'En attente' },
    { reference: 'DEV-0138', date: '28/08/2026', subject: '8 pneus poids lourd', amount: '31 600,00 DH', status: 'Accepté' },
    { reference: 'DEV-0121', date: '02/08/2026', subject: 'Révision + 2 pneus', amount: '4 950,00 DH', status: 'Expiré' },
  ];
}
