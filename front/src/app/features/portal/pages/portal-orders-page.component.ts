import { Component } from '@angular/core';

interface PortalOrderRow {
  reference: string;
  date: string;
  articles: string;
  amount: string;
  status: 'Réglé' | 'Non réglé';
}

/**
 * Étape 5 — coquille de démonstration : ce que verrait un compte client B2B.
 * Données d'exemple statiques, aucun backend client derrière (voir
 * DESIGN_SYSTEM.md / CLAUDE.md). Seul cet écran est spécifié au pixel par le
 * handoff ; Devis / Factures / Mon compte réutilisent le même vocabulaire
 * visuel sans maquette dédiée.
 */
@Component({
  selector: 'app-portal-orders-page',
  standalone: true,
  templateUrl: './portal-orders-page.component.html',
  styleUrl: './portal-orders-page.component.scss',
})
export class PortalOrdersPageComponent {
  readonly ordersInProgress = 3;
  readonly invoicedOutstanding = '11 640 DH';
  readonly nextDueDate = '15/09/2026';

  readonly orders: PortalOrderRow[] = [
    { reference: 'VTE-2416', date: '02/09/2026', articles: '4 pneus', amount: '11 640,00 DH', status: 'Non réglé' },
    { reference: 'VTE-2390', date: '24/08/2026', articles: '2 pneus + montage', amount: '3 280,00 DH', status: 'Réglé' },
    { reference: 'VTE-2355', date: '10/08/2026', articles: '8 pneus', amount: '26 400,00 DH', status: 'Réglé' },
    { reference: 'VTE-2298', date: '22/07/2026', articles: '4 pneus', amount: '9 840,00 DH', status: 'Réglé' },
  ];
}
