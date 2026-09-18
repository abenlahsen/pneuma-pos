import { Component, OnInit, effect, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { RailComponent } from './shared/rail/rail.component';
import { TopbarComponent } from './shared/topbar/topbar.component';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';
import { SettingsService } from './features/settings/data-access/settings.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RailComponent, TopbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private companySettings = signal<unknown | null>(null);

  constructor(
    public authService: AuthService,
    private titleService: Title,
    private settingsService: SettingsService,
    private themeService: ThemeService,
  ) {
    effect(() => {
      const user = this.authService.user();

      if (!user) {
        this.companySettings.set(null);
        this.themeService.applyCompanyTheme(null);
        return;
      }

      this.loadCompanySettings();
    });
  }

  ngOnInit(): void {
    this.titleService.setTitle(environment.appTitle);
  }

  private loadCompanySettings(): void {
    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.companySettings.set(settings);
        this.themeService.applyCompanyTheme(settings);

        if (settings.favicon_url) {
          this.updateFavicon(settings.favicon_url);
        }
      },
    });
  }

  /**
   * Le favicon réglé ne remplace celui livré qu'une fois réellement chargé.
   * Un chemin enregistré dont le fichier a disparu — cas vu quand la base
   * survit à un reset du volume de stockage — remplaçait sinon une icône
   * valide par une icône cassée, sans que rien ne le signale. Un `<link>` ne
   * permettant pas de rattraper l'échec, on charge l'image d'abord.
   */
  private updateFavicon(url: string): void {
    const probe = new Image();
    probe.onload = () => this.setFaviconHref(url);
    probe.src = url;
  }

  private setFaviconHref(url: string): void {
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
