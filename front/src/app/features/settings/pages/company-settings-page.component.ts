import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../data-access/settings.service';
import { CityService } from '../../../core/services/city.service';
import {
  CompanySettings,
  DEFAULT_COMPANY_THEME_SETTINGS,
  ThemeMode,
  UpdateCompanySettingsPayload,
} from '../models/company-settings.model';

type MenuLayoutOption = 'horizontal' | 'vertical';
type NavbarVariantOption = 'default' | 'compact' | 'flat';
type ContentWidthOption = 'full' | 'boxed' | 'compact';

@Component({
  selector: 'app-company-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-settings-page.component.html',
  styleUrls: ['./company-settings-page.component.scss'],
})
export class CompanySettingsPageComponent implements OnInit {
  readonly themeModeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: 'Système' },
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
  ];

  readonly menuLayoutOptions: Array<{ value: MenuLayoutOption; label: string }> = [
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
  ];

  readonly navbarVariantOptions: Array<{ value: NavbarVariantOption; label: string }> = [
    { value: 'default', label: 'Standard' },
    { value: 'compact', label: 'Compacte' },
    { value: 'flat', label: 'Plate' },
  ];

  readonly contentWidthOptions: Array<{ value: ContentWidthOption; label: string }> = [
    { value: 'full', label: 'Pleine largeur' },
    { value: 'boxed', label: 'Encadrée' },
    { value: 'compact', label: 'Compacte' },
  ];

  form = signal<UpdateCompanySettingsPayload>({
    company_name: '',
    legal_name: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    tax_id: null,
    rc: null,
    ice: null,
    cnss: null,
    patente: null,
    remove_logo: false,
    remove_favicon: false,
    theme_mode: DEFAULT_COMPANY_THEME_SETTINGS.theme_mode,
    primary_color: DEFAULT_COMPANY_THEME_SETTINGS.primary_color,
    accent_color: DEFAULT_COMPANY_THEME_SETTINGS.accent_color,
    surface_color: DEFAULT_COMPANY_THEME_SETTINGS.surface_color,
    menu_layout: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { menu_layout?: MenuLayoutOption }).menu_layout ?? 'vertical',
    navbar_variant: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { navbar_variant?: NavbarVariantOption }).navbar_variant ?? 'default',
    content_width: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { content_width?: ContentWidthOption }).content_width ?? 'full',
    prime_threshold: 0,
  });

  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  logoUrl = signal<string | null>(null);
  faviconUrl = signal<string | null>(null);
  selectedLogoFile = signal<File | null>(null);
  selectedFaviconFile = signal<File | null>(null);

  previewThemeMode = computed(() => this.form().theme_mode);
  previewMenuLayout = computed(() => ((this.form() as UpdateCompanySettingsPayload & { menu_layout?: MenuLayoutOption }).menu_layout ?? 'vertical'));
  previewNavbarVariant = computed(() => ((this.form() as UpdateCompanySettingsPayload & { navbar_variant?: NavbarVariantOption }).navbar_variant ?? 'default'));
  previewContentWidth = computed(() => ((this.form() as UpdateCompanySettingsPayload & { content_width?: ContentWidthOption }).content_width ?? 'full'));
  previewStyles = computed(() => ({
    '--preview-primary': this.form().primary_color,
    '--preview-accent': this.form().accent_color,
    '--preview-surface': this.form().surface_color,
    '--preview-text': this.getPreviewTextColor(),
    '--preview-muted': this.getPreviewMutedColor(),
    '--preview-border': this.getPreviewBorderColor(),
    '--preview-shadow': this.getPreviewShadowColor(),
  }));

  cities: string[] = [];

  constructor(private settingsService: SettingsService, private cityService: CityService) {}

  ngOnInit(): void {
    this.cityService.getCities().subscribe(cities => this.cities = cities);
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.settingsService.getCompanySettings().subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Impossible de charger les paramètres de l'entreprise.");
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.settingsService.updateCompanySettings(
      this.form(),
      this.selectedLogoFile(),
      this.selectedFaviconFile(),
    ).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.successMessage.set("Les informations de l'entreprise ont été enregistrées.");
        this.saving.set(false);
      },
      error: () => {
        this.errorMessage.set("Impossible d'enregistrer les paramètres de l'entreprise.");
        this.saving.set(false);
      },
    });
  }

  updateField<K extends keyof UpdateCompanySettingsPayload>(key: K, value: UpdateCompanySettingsPayload[K]): void {
    this.form.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  resetThemeDefaults(): void {
    this.form.update((current) => ({
      ...current,
      theme_mode: DEFAULT_COMPANY_THEME_SETTINGS.theme_mode,
      primary_color: DEFAULT_COMPANY_THEME_SETTINGS.primary_color,
      accent_color: DEFAULT_COMPANY_THEME_SETTINGS.accent_color,
      surface_color: DEFAULT_COMPANY_THEME_SETTINGS.surface_color,
      menu_layout: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { menu_layout?: MenuLayoutOption }).menu_layout ?? 'vertical',
      navbar_variant: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { navbar_variant?: NavbarVariantOption }).navbar_variant ?? 'default',
      content_width: (DEFAULT_COMPANY_THEME_SETTINGS as UpdateCompanySettingsPayload & { content_width?: ContentWidthOption }).content_width ?? 'full',
    }));
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedLogoFile.set(file);
    this.updateField('remove_logo', false);

    if (file) {
      this.logoUrl.set(URL.createObjectURL(file));
    }
  }

  onFaviconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedFaviconFile.set(file);
    this.updateField('remove_favicon', false);

    if (file) {
      this.faviconUrl.set(URL.createObjectURL(file));
    }
  }

  removeLogo(): void {
    this.selectedLogoFile.set(null);
    this.logoUrl.set(null);
    this.updateField('remove_logo', true);
  }

  removeFavicon(): void {
    this.selectedFaviconFile.set(null);
    this.faviconUrl.set(null);
    this.updateField('remove_favicon', true);
  }

  private applySettings(settings: CompanySettings): void {
    this.form.set(this.mapSettingsToPayload(settings));
    this.logoUrl.set(settings.logo_url ?? null);
    this.faviconUrl.set(settings.favicon_url ?? null);
    this.selectedLogoFile.set(null);
    this.selectedFaviconFile.set(null);
  }

  private mapSettingsToPayload(settings: CompanySettings): UpdateCompanySettingsPayload {
    const layoutSettings = settings as CompanySettings & {
      menu_layout?: MenuLayoutOption;
      navbar_variant?: NavbarVariantOption;
      content_width?: ContentWidthOption;
    };

    return {
      company_name: settings.company_name ?? '',
      legal_name: settings.legal_name ?? null,
      email: settings.email ?? null,
      phone: settings.phone ?? null,
      address: settings.address ?? null,
      city: settings.city ?? null,
      state: settings.state ?? null,
      postal_code: settings.postal_code ?? null,
      country: settings.country ?? null,
      tax_id: settings.tax_id ?? null,
      rc: settings.rc ?? null,
      ice: settings.ice ?? null,
      cnss: settings.cnss ?? null,
      patente: settings.patente ?? null,
      remove_logo: false,
      remove_favicon: false,
      theme_mode: settings.theme_mode ?? DEFAULT_COMPANY_THEME_SETTINGS.theme_mode,
      primary_color: settings.primary_color ?? DEFAULT_COMPANY_THEME_SETTINGS.primary_color,
      accent_color: settings.accent_color ?? DEFAULT_COMPANY_THEME_SETTINGS.accent_color,
      surface_color: settings.surface_color ?? DEFAULT_COMPANY_THEME_SETTINGS.surface_color,
      menu_layout: layoutSettings.menu_layout ?? 'vertical',
      navbar_variant: layoutSettings.navbar_variant ?? 'default',
      content_width: layoutSettings.content_width ?? 'full',
      prime_threshold: settings.prime_threshold ?? 0,
    } as UpdateCompanySettingsPayload;
  }

  private getPreviewTextColor(): string {
    return this.previewThemeMode() === 'dark' ? '#f8fafc' : '#0f172a';
  }

  private getPreviewMutedColor(): string {
    return this.previewThemeMode() === 'dark' ? '#cbd5e1' : '#475569';
  }

  private getPreviewBorderColor(): string {
    return this.previewThemeMode() === 'dark' ? 'rgba(148, 163, 184, 0.24)' : 'rgba(148, 163, 184, 0.3)';
  }

  private getPreviewShadowColor(): string {
    return this.previewThemeMode() === 'dark' ? 'rgba(15, 23, 42, 0.38)' : 'rgba(15, 23, 42, 0.08)';
  }
}