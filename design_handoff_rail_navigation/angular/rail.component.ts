import { Component, HostListener, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { CompanySettings } from '../../features/settings/models/company-settings.model';
import { IconComponent } from '../icon/icon.component';

export interface RailItem {
  /** Clé d'icône — voir PATHS dans icon.component.ts */
  icon: string;
  /** Libellé : infobulle dans le rail, titre du panneau */
  label: string;
  /** Destination directe. Exclusif avec `children`. */
  route?: string;
  exact?: boolean;
  permission?: string;
  /** Sous-destinations : l'icône ouvre un panneau au lieu de naviguer. */
  children?: RailItem[];
}

@Component({
  selector: 'app-rail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './rail.component.html',
  styleUrl: './rail.component.scss',
})
export class RailComponent {
  /* — Structure : reprise telle quelle de navbar.component.ts, emoji retirés
       des libellés et remplacés par une clé d'icône. Les cinq premières
       entrées sont les pages quotidiennes ; elles naviguent directement. — */
  readonly allItems: RailItem[] = [
    { icon: 'home',      label: 'Accueil',      route: '/dashboard', exact: true },
    { icon: 'sales',     label: 'Ventes',       route: '/sales',           permission: 'view sales' },
    { icon: 'service',   label: 'Service Auto', route: '/service-orders',  permission: 'view service-orders' },
    { icon: 'purchases', label: 'Achats',       route: '/achats',          permission: 'view purchases' },
    { icon: 'cash',      label: 'Cash Flow',    route: '/cash-flow',       permission: 'view cash-flow' },
    {
      icon: 'stock', label: 'Stock',
      children: [
        { icon: 'stock',     label: 'Produits',   route: '/products', permission: 'view products' },
        { icon: 'inventory', label: 'Inventaire', route: '/stock',    permission: 'view stock' },
        { icon: 'brands',    label: 'Marques',    route: '/brands',   permission: 'view brands' },
      ],
    },
    {
      icon: 'parties', label: 'Tiers',
      children: [
        { icon: 'client',   label: 'Clients',       route: '/clients',   permission: 'view clients' },
        { icon: 'supplier', label: 'Fournisseurs',  route: '/suppliers', permission: 'view suppliers' },
        { icon: 'carrier',  label: 'Transporteurs', route: '/carriers',  permission: 'view carriers' },
        { icon: 'partner',  label: 'Partenaires',   route: '/partners',  permission: 'view partners' },
      ],
    },
    {
      icon: 'finance', label: 'Finance',
      children: [
        { icon: 'finance',   label: 'Comptes',    route: '/accounts',   permission: 'view accounts' },
        { icon: 'bonus',     label: 'Primes',     route: '/primes',     permission: 'view primes' },
        { icon: 'payroll',   label: 'Charges RH', route: '/charges-rh', permission: 'view hr-charges' },
        { icon: 'reporting', label: 'Reporting',  route: '/reporting',  permission: 'view reporting' },
      ],
    },
    {
      icon: 'settings', label: 'Administration',
      children: [
        { icon: 'users',     label: 'Utilisateurs', route: '/users',        permission: 'view users' },
        { icon: 'roles',     label: 'Rôles',        route: '/roles',        permission: 'view roles' },
        { icon: 'activity',  label: 'Activité',     route: '/activity-log', permission: 'view activity-log' },
        { icon: 'kpi',       label: 'KPI',          route: '/kpi-history',  permission: 'view activity-log' },
        { icon: 'settings',  label: 'Entreprise',   route: '/settings',     permission: 'view settings' },
        { icon: 'brands',    label: 'Catégories',   route: '/settings/transaction-categories', permission: 'view transaction-categories' },
      ],
    },
  ];

  /** Panneau ouvert, identifié par le libellé du groupe. Un seul à la fois —
      l'accordéon additif de l'ancien navbar est remplacé par ce signal. */
  readonly openPanel = signal<string | null>(null);

  readonly companySettings = signal<CompanySettings | null>(null);
  readonly brandLogoUrl = signal('logo.png');
  readonly userName = computed(() => this.authService.user()?.name ?? '');
  readonly userRole = computed(() => this.authService.user()?.roles?.[0]?.name ?? '');
  readonly initials = computed(() =>
    this.userName().split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
  );

  /** Mêmes règles de permission qu'avant : un groupe disparaît si aucun
      de ses enfants n'est autorisé. */
  readonly items = computed<RailItem[]>(() =>
    this.allItems
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
