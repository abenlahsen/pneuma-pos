import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/data-access/settings.service';
import { ShellNavService } from '../../core/services/shell-nav.service';
import { IconComponent } from '../icon/icon.component';
import { CommandPaletteService } from '../command-palette/command-palette.service';

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
  /** Logo livré avec l'application, servi depuis public/. */
  private readonly defaultLogo = 'logo.png';

  brandLogoUrl = signal(this.defaultLogo);
  userMenuOpen = signal(false);
  now = signal(new Date());

  userName = computed(() => this.authService.user()?.name || '');
  userInitial = computed(() => this.userName().charAt(0).toUpperCase() || '?');
  userRole = computed(() => {
    const roles = this.authService.user()?.roles;
    return roles && roles.length > 0 ? roles[0].name : '';
  });

  private clockHandle?: ReturnType<typeof setInterval>;

  /** ⌘ sur Mac, Ctrl ailleurs : afficher l'autre raccourci ne sert personne. */
  readonly shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  private readonly shellNav = inject(ShellNavService);

  /** Ouvre ou referme le rail en volet, sous le seuil de changement de forme. */
  toggleNavPanel(): void {
    this.shellNav.toggle();
  }

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private elementRef: ElementRef<HTMLElement>,
    private commandPalette: CommandPaletteService,
  ) {}

  openSearch(): void {
    this.commandPalette.open();
  }

  ngOnInit(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => this.brandLogoUrl.set(settings.logo_url || this.defaultLogo),
      // Réglages illisibles : on garde le logo livré plutôt qu'un espace vide.
      error: () => this.brandLogoUrl.set(this.defaultLogo),
    });

    this.clockHandle = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.clockHandle) clearInterval(this.clockHandle);
  }

  /**
   * Le repli `settings.logo_url || 'logo.png'` ne couvrait que l'absence de
   * réglage. Un chemin bel et bien enregistré mais dont le fichier a disparu
   * du disque — cas vu en environnement de développement, la base gardant le
   * chemin après un reset du volume — répond 404 et ne laissait qu'un espace
   * vide dans la barre haute, sans rien dire.
   *
   * La garde évite la boucle si le logo livré lui-même venait à manquer.
   */
  onLogoError(): void {
    if (this.brandLogoUrl() !== this.defaultLogo) {
      this.brandLogoUrl.set(this.defaultLogo);
    }
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
