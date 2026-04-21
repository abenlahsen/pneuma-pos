import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';
import { SettingsService } from './features/settings/data-access/settings.service';
import { ThemeService } from './core/services/theme.service';
import { MenuLayout } from './features/settings/models/company-settings.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private companySettings = signal<{ menu_layout?: MenuLayout } | null>(null);
  readonly menuLayout = computed<MenuLayout>(() => this.companySettings()?.menu_layout ?? 'vertical');

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
