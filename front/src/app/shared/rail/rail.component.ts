import { Component, HostListener, computed, effect, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { CompanySettings } from '../../features/settings/models/company-settings.model';
import { IconComponent } from '../icon/icon.component';
import { NAV_ITEMS, PORTAL_NAV_ITEMS, RailItem } from './nav-items';

export type { RailItem } from './nav-items';

@Component({
  selector: 'app-rail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './rail.component.html',
  styleUrl: './rail.component.scss',
})
export class RailComponent {
  /** Étape 5 : /portail bascule sur le jeu de destinations client — même
      rail, quatre entrées sans enfants, aucun panneau, aucun lien interne.
      Coquille de démonstration : il n'existe pas encore de compte client
      distinct, donc c'est la route (et non le rôle) qui décide ici. */
  readonly isPortal = computed(() => this.currentUrl().startsWith('/portail'));

  readonly allItems = computed<RailItem[]>(() => (this.isPortal() ? PORTAL_NAV_ITEMS : NAV_ITEMS));

  /** Panneau ouvert, identifié par le libellé du groupe. Un seul à la fois —
      l'accordéon additif de l'ancien navbar est remplacé par ce signal. */
  readonly openPanel = signal<string | null>(null);

  readonly companySettings = signal<CompanySettings | null>(null);
  readonly brandLogoUrl = signal('logo.png');
  readonly userName = computed(() => (this.isPortal() ? 'Transport Chaouia' : this.authService.user()?.name ?? ''));
  readonly userRole = computed(() =>
    this.isPortal() ? 'Compte 1042' : this.authService.user()?.roles?.[0]?.name ?? '',
  );
  readonly initials = computed(() =>
    this.isPortal()
      ? 'TC'
      : this.userName().split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
  );

  /** Mêmes règles de permission qu'avant : un groupe disparaît si aucun
      de ses enfants n'est autorisé. La liste client n'a pas de `permission` —
      elle n'a pas non plus d'enfants, donc rien à filtrer. */
  readonly items = computed<RailItem[]>(() =>
    this.allItems()
      .map((item) => {
        if (item.children) {
          const children = item.children.filter(
            (c) => !c.permission || this.authService.hasPermission(c.permission),
          );
          return children.length ? { ...item, children } : null;
        }
        return !item.permission || this.authService.hasPermission(item.permission) ? item : null;
      })
      .filter((i): i is RailItem => i !== null),
  );

  readonly panelItem = computed<RailItem | null>(
    () => this.items().find((i) => i.label === this.openPanel()) ?? null,
  );

  /** Le groupe qui contient la route courante — sert à marquer l'icône
      active même quand le panneau est fermé (y compris après une arrivée
      par la recherche). */
  readonly activeGroup = computed<string | null>(() => {
    const url = this.currentUrl();
    const match = this.items().find((i) =>
      i.children?.some((c) => c.route && url.startsWith(c.route)),
    );
    return match?.label ?? null;
  });

  private readonly currentUrl = signal('/');

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
    private router: Router,
  ) {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.companySettings.set(settings);
        this.brandLogoUrl.set(settings.logo_url || 'logo.png');
      },
    });

    this.currentUrl.set(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.openPanel.set(null);   // le panneau se referme à la navigation
    });

    // Rampe bleue de _tokens.scss le temps de la visite du portail — retirée
    // dès qu'on en sort, pour ne jamais teinter l'app interne par erreur.
    effect(() => {
      if (this.isPortal()) {
        document.documentElement.setAttribute('data-brand', 'client');
      } else {
        document.documentElement.removeAttribute('data-brand');
      }
    });
  }

  /** Clic sur une icône de groupe : bascule. Plus de clic mort — c'est le
      correctif du constat 01. */
  togglePanel(item: RailItem): void {
    this.openPanel.update((open) => (open === item.label ? null : item.label));
  }

  closePanel(): void {
    this.openPanel.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePanel();
  }

  logout(): void {
    this.authService.logout();
  }
}
