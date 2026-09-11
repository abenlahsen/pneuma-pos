import { Component, OnInit, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { RailComponent } from './shared/rail/rail.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';
import { SettingsService } from './features/settings/data-access/settings.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RailComponent, CommandPaletteComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
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
