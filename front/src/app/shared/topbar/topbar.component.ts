import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Barre haute de 60px (refonte 2b, étape 3) — remplace le haut de
 * shared/navbar/. Porte le logo, la date/heure, et l'avatar (menu Déconnexion).
 *
 * La case de recherche est volontairement inerte pour cette étape : elle
 * reproduit le chrome visuel du prototype (`⌘K`), mais aucune palette de
 * commandes n'existe encore dans ce codebase pour la brancher — construire
 * une recherche réelle (destinations + ventes + produits) est un chantier à
 * part, pas un sous-produit du remplacement de la navigation.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit, OnDestroy {
  brandLogoUrl = signal('logo.png');
  userMenuOpen = signal(false);
  now = signal(new Date());

  userName = computed(() => this.authService.user()?.name || '');
  userInitial = computed(() => this.userName().charAt(0).toUpperCase() || '?');
  userRole = computed(() => {
    const roles = this.authService.user()?.roles;
    return roles && roles.length > 0 ? roles[0].name : '';
  });

  private clockHandle?: ReturnType<typeof setInterval>;

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => this.brandLogoUrl.set(settings.logo_url || 'logo.png'),
    });

    this.clockHandle = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.clockHandle) clearInterval(this.clockHandle);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.userMenuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }
}
