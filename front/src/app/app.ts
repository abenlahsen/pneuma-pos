import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RailComponent } from './shared/rail/rail.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';
import { SettingsService } from './features/settings/data-access/settings.service';
import { ThemeService } from './core/services/theme.service';
import { PageHeaderService } from './core/services/page-header.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RailComponent, CommandPaletteComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly pageHeader = inject(PageHeaderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Date du jour en francais. Formatee ici plutot que par le pipe `date` :
   * enregistrer la locale `fr` changerait aussi le format de tous les nombres
   * de l'application (espace comme separateur, virgule decimale).
   */
  readonly today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

  /**
   * Coquille a hauteur fixe : barre superieure et contenu qui defile seul.
   * Decidee par la route (`data.shell`), pas par la page — sinon la barre
   * apparaitrait apres le premier rendu et ferait sauter la mise en page.
   */
  readonly isFixedShell = signal(false);

  constructor(
    public authService: AuthService,
    private titleService: Title,
    private settingsService: SettingsService,
    private themeService: ThemeService,
  ) {
    effect(() => {
      const user = this.authService.user();

      if (!user) {
        this.themeService.applyCompanyTheme(null);
        return;
      }

      this.loadCompanySettings();
    });
  }

  ngOnInit(): void {
    this.titleService.setTitle(environment.appTitle);

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.isFixedShell.set(this.deepestRoute().snapshot.data['shell'] === 'fixed'));
  }

  /** La donnee `shell` est portee par la route effectivement affichee. */
  private deepestRoute(): ActivatedRoute {
    let route = this.route;
    while (route.firstChild) route = route.firstChild;

    return route;
  }

  private loadCompanySettings(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.themeService.applyCompanyTheme(settings);

        if (settings.favicon_url) {
          this.updateFavicon(settings.favicon_url);
        }
      },
    });
  }

  private updateFavicon(url: string): void {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    link.type = 'image/x-icon';
    link.href = url;
  }
}
