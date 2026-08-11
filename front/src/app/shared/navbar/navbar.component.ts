import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { CompanySettings, MenuLayout } from '../../features/settings/models/company-settings.model';

interface NavItem {
  label: string;
  route?: string;
  permission?: string;
  exact?: boolean;
  children?: NavItem[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  userName = computed(() => this.authService.user()?.name || '');
  companySettings = signal<CompanySettings | null>(null);
  brandLogoUrl = signal('logo.png');
  readonly menuLayout = computed<MenuLayout>(() => this.companySettings()?.menu_layout ?? 'vertical');
  userRole = computed(() => {
    const roles = this.authService.user()?.roles;
    return roles && roles.length > 0 ? roles[0].name : '';
  });
  menuOpen = false;

  // Groups expanded by the user (vertical layout accordion) — a group's
  // label doubles as its identity key, same pattern as `activeType()` on the
  // transaction-categories page. Additive: opening one group never closes
  // another; only autoExpandActiveGroup() decides what opens by default.
  expandedGroups = signal<Set<string>>(new Set());

  // Pages used daily stay one click away; everything else is grouped by
  // theme (Finance, Administration) so the vertical menu doesn't need to
  // list ~25 rows at once — see navbar.component.scss for the accordion
  // collapse behind `.expanded`.
  allNavItems: NavItem[] = [
    { label: '🏠 Accueil', route: '/dashboard', exact: true },
    { label: '🏷️ Ventes', route: '/sales', permission: 'view sales' },
    { label: '🔧 Service Auto', route: '/service-orders', permission: 'view service-orders' },
    { label: '📦 Achats', route: '/achats', permission: 'view purchases' },
    { label: '💰 Cash Flow', route: '/cash-flow', permission: 'view cash-flow' },
    {
      label: '🛞 Stock',
      children: [
        { label: '🛞 Produits', route: '/products', permission: 'view products' },
        { label: '📋 Inventaire', route: '/stock', permission: 'view stock' },
        { label: '🏭 Marques', route: '/brands', permission: 'view brands' },
      ]
    },
    {
      label: '🤝 Tiers',
      children: [
        { label: '🧑‍💼 Clients', route: '/clients', permission: 'view clients' },
        { label: '🏢 Fournisseurs', route: '/suppliers', permission: 'view suppliers' },
        { label: '🚚 Transporteurs', route: '/carriers', permission: 'view carriers' },
        { label: '🤝 Partenaires', route: '/partners', permission: 'view partners' },
      ]
    },
    {
      label: '🏦 Finance',
      children: [
        { label: '🏦 Comptes', route: '/accounts', permission: 'view accounts' },
        { label: '🎯 Primes', route: '/primes', permission: 'view primes' },
        { label: '🧾 Charges RH', route: '/charges-rh', permission: 'view hr-charges' },
      ]
    },
    {
      label: '👤 Administration',
      children: [
        { label: '👥 Utilisateurs', route: '/users', permission: 'view users' },
        { label: '🔐 Rôles', route: '/roles', permission: 'view roles' },
        { label: '📋 Activité', route: '/activity-log', permission: 'view activity-log' },
        { label: '📈 KPI', route: '/kpi-history', permission: 'view activity-log' },
      ]
    },
    {
      label: '⚙️ Paramètres',
      children: [
        { label: '🏢 Entreprise', route: '/settings', permission: 'view settings' },
        { label: '🏷️ Catégories', route: '/settings/transaction-categories', permission: 'view transaction-categories' },
      ]
    },
  ];

  visibleNavItems = computed(() => {
    return this.allNavItems
      .map(item => {
        if (item.children) {
          const visibleChildren = item.children.filter(child => !child.permission || this.authService.hasPermission(child.permission));
          if (visibleChildren.length > 0) {
            return { ...item, children: visibleChildren };
          }
          return null;
        }
        if (!item.permission || this.authService.hasPermission(item.permission)) {
          return item;
        }
        return null;
      })
      .filter((item): item is NavItem => item !== null);
  });

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

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.autoExpandActiveGroup();
    });
    this.autoExpandActiveGroup();
  }

  // Opens whichever group contains the current route, without touching
  // groups the user already opened manually — so navigating around never
  // surprises them by collapsing an unrelated section they left open.
  private autoExpandActiveGroup(): void {
    const url = this.router.url;
    const match = this.allNavItems.find((item) =>
      item.children?.some((child) => child.route && url.startsWith(child.route)),
    );
    if (match) {
      this.expandedGroups.update((set) => new Set(set).add(match.label));
    }
  }

  isGroupExpanded(item: NavItem): boolean {
    return this.expandedGroups().has(item.label);
  }

  toggleGroup(item: NavItem, event: Event): void {
    event.preventDefault();
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(item.label)) {
        next.delete(item.label);
      } else {
        next.add(item.label);
      }
      return next;
    });
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; }
  logout() { this.authService.logout(); }
}
