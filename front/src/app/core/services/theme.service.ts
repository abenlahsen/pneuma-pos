import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import {
  CompanySettings,
  ContentWidth,
  DEFAULT_COMPANY_THEME_SETTINGS,
  MenuLayout,
  NavbarVariant,
  ThemeMode,
} from '../../features/settings/models/company-settings.model';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private mediaQuery: MediaQueryList | null = null;
  private systemThemeListener = () => this.applyResolvedMode();

  constructor(@Inject(DOCUMENT) private document: Document) {}

  applyCompanyTheme(settings: Partial<CompanySettings> | null | undefined): void {
    const themeMode = settings?.theme_mode ?? DEFAULT_COMPANY_THEME_SETTINGS.theme_mode;
    const primaryColor = settings?.primary_color ?? DEFAULT_COMPANY_THEME_SETTINGS.primary_color;
    const accentColor = settings?.accent_color ?? DEFAULT_COMPANY_THEME_SETTINGS.accent_color;
    const surfaceColor = settings?.surface_color ?? DEFAULT_COMPANY_THEME_SETTINGS.surface_color;
    const menuLayout = settings?.menu_layout ?? DEFAULT_COMPANY_THEME_SETTINGS.menu_layout;
    const navbarVariant = settings?.navbar_variant ?? DEFAULT_COMPANY_THEME_SETTINGS.navbar_variant;
    const contentWidth = settings?.content_width ?? DEFAULT_COMPANY_THEME_SETTINGS.content_width;

    const root = this.document.documentElement;

    root.style.setProperty('--app-primary', primaryColor);
    root.style.setProperty('--app-accent', accentColor);
    root.style.setProperty('--app-surface', surfaceColor);
    root.setAttribute('data-theme-mode', themeMode);
    this.applyLayoutAttributes(root, menuLayout, navbarVariant, contentWidth);

    this.bindSystemTheme(themeMode);
    this.applyResolvedMode();
  }

  private applyLayoutAttributes(
    root: HTMLElement,
    menuLayout: MenuLayout,
    navbarVariant: NavbarVariant,
    contentWidth: ContentWidth,
  ): void {
    root.setAttribute('data-menu-layout', menuLayout);
    root.setAttribute('data-navbar-variant', navbarVariant);
    root.setAttribute('data-content-width', contentWidth);
  }

  private bindSystemTheme(themeMode: ThemeMode): void {
    this.unbindSystemTheme();

    if (themeMode !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', this.systemThemeListener);
  }

  private unbindSystemTheme(): void {
    if (!this.mediaQuery) {
      return;
    }

    this.mediaQuery.removeEventListener('change', this.systemThemeListener);
    this.mediaQuery = null;
  }

  private applyResolvedMode(): void {
    const root = this.document.documentElement;
    const themeMode = (root.getAttribute('data-theme-mode') as ThemeMode | null) ?? 'system';
    const resolvedMode =
      themeMode === 'system'
        ? this.mediaQuery?.matches ? 'dark' : 'light'
        : themeMode;

    root.setAttribute('data-theme-resolved', resolvedMode);
  }
}