import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { PageHeaderService } from '../../../core/services/page-header.service';

/** Étape 5 — coquille de démonstration, données d'exemple statiques. Pas de
 *  maquette dédiée dans le handoff : réutilise le vocabulaire visuel de
 *  "Mes commandes" (portal-orders-page). */
@Component({
  selector: 'app-portal-account-page',
  standalone: true,
  templateUrl: './portal-account-page.component.html',
  styleUrl: './portal-account-page.component.scss',
})
export class PortalAccountPageComponent implements OnInit, OnDestroy {
  private readonly pageHeader = inject(PageHeaderService);

  /** Le titre va dans la barre de la coquille, comme les ecrans internes : le
   *  portail est le dernier endroit ou laisser deux motifs concurrents. */
  ngOnInit(): void {
    this.pageHeader.set('Mon compte', 'Transport Chaouia · ', 'Compte 1042');
  }

  ngOnDestroy(): void {
    this.pageHeader.clear();
  }
}
