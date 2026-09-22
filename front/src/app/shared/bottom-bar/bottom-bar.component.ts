import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { AuthService } from '../../core/services/auth.service';

interface BottomEntry {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  /** Une action, pas une destination : elle ne s'allume jamais. */
  action?: boolean;
  exact?: boolean;
}

/**
 * La barre basse — refonte 2b, gabarit 14b.
 *
 * Sous le seuil de changement de forme, le rail disparaît et cinq entrées le
 * remplacent. Cinq, pas davantage : au-delà les cibles passent sous le pouce
 * confortable, et le reste des destinations est atteignable par le ☰ de la
 * barre haute, qui rouvre le rail entier en volet.
 *
 * Le choix des cinq n'est pas un sous-ensemble arbitraire du rail : ce sont
 * les quatre écrans qu'on ouvre en boucle dans un atelier, plus l'action qui
 * justifie d'avoir le téléphone en main.
 */
@Component({
  selector: 'app-bottom-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './bottom-bar.component.html',
  styleUrl: './bottom-bar.component.scss',
})
export class BottomBarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly entries: BottomEntry[] = [
    { label: 'Accueil', icon: 'home', route: '/dashboard', exact: true },
    { label: 'Ventes', icon: 'tag', route: '/sales', permission: 'view sales' },
    { label: 'Stock', icon: 'package', route: '/stock', permission: 'view stock' },
    { label: 'Service', icon: 'wrench', route: '/service-orders', permission: 'view service-orders' },
    { label: 'Nouveau', icon: 'plus', route: '/sales/new', permission: 'create sales', action: true },
  ];

  readonly visibleEntries = computed(() =>
    this.entries.filter((entry) => !entry.permission || this.authService.hasPermission(entry.permission)),
  );
}
