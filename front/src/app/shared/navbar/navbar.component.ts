import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  permission?: string;
  exact?: boolean;
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
  userRole = computed(() => {
    const roles = this.authService.user()?.roles;
    return roles && roles.length > 0 ? roles[0].name : '';
  });
  menuOpen = false;

  allNavItems: NavItem[] = [
    { label: '🏠 Accueil', route: '/dashboard', exact: true },
    { label: '🏷️ Ventes', route: '/sales', permission: 'view sales' },
    { label: '📦 Achats', route: '/achats', permission: 'view purchases' },
    { label: '💰 Cash Flow', route: '/cash-flow', permission: 'view cash-flow' },
    { label: '📋 Stock', route: '/stock', permission: 'view stock' },
    { label: '🏢 Fournisseurs', route: '/suppliers', permission: 'view suppliers' },
    { label: '🚚 Transporteurs', route: '/carriers', permission: 'view carriers' },
    { label: '🤝 Partenaires', route: '/partners', permission: 'view partners' },
    { label: '👥 Utilisateurs', route: '/users', permission: 'view users' },
    { label: '🔐 Rôles', route: '/roles', permission: 'view roles' },
  ];

  visibleNavItems = computed(() =>
    this.allNavItems.filter(item =>
      !item.permission || this.authService.hasPermission(item.permission)
    )
  );

  constructor(private authService: AuthService) {}

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; }
  logout() { this.authService.logout(); }
}
