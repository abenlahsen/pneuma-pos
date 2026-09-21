import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SettingsService } from '../data-access/settings.service';
import { CityService } from '../../../core/services/city.service';
import { AuthService } from '../../../core/services/auth.service';
import { CompanySettings, UpdateCompanySettingsPayload } from '../models/company-settings.model';
import {
  SECTION_HEADERS,
  SETTINGS_GROUPS,
  SettingsEntry,
  SettingsSectionId,
} from './settings-sections';

/** Les champs que chaque section édite — ce qui définit « modifié » et « annuler ». */
const SECTION_FIELDS: Record<SettingsSectionId, (keyof UpdateCompanySettingsPayload)[]> = {
  identity: [
    'company_name', 'legal_name', 'email', 'phone',
    'address', 'city', 'state', 'postal_code', 'country',
    'tax_id', 'rc', 'ice', 'cnss', 'patente',
  ],
  documents: ['remove_logo', 'remove_favicon'],
  primes: ['prime_threshold'],
};

@Component({
  selector: 'app-company-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './company-settings-page.component.html',
  styleUrls: ['./company-settings-page.component.scss'],
})
export class CompanySettingsPageComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly cityService = inject(CityService);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly groups = SETTINGS_GROUPS;

  readonly activeSection = signal<SettingsSectionId>('identity');

  readonly header = computed(() => SECTION_HEADERS[this.activeSection()]);

  form = signal<UpdateCompanySettingsPayload>(emptyPayload());

  /**
   * L'état enregistré, gardé à part. Le pied compare les deux pour dire ce qui
   * est modifié et pour savoir quoi remettre quand on annule — chaque section
   * s'enregistre seule, il n'y a plus de bouton unique en fin de page.
   */
  private readonly saved = signal<UpdateCompanySettingsPayload>(emptyPayload());

  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  logoUrl = signal<string | null>(null);
  faviconUrl = signal<string | null>(null);
  selectedLogoFile = signal<File | null>(null);
  selectedFaviconFile = signal<File | null>(null);
  lastSavedAt = signal<Date | null>(null);

  /** Comptes affichés dans la liste de gauche, quand on sait les obtenir. */
  readonly counts = signal<Partial<Record<NonNullable<SettingsEntry['countKey']>, number>>>({});

  cities: string[] = [];

  /** Les champs modifiés de la section affichée, et rien d'autre. */
  readonly dirtyFields = computed(() => {
    const current = this.form();
    const saved = this.saved();
    return SECTION_FIELDS[this.activeSection()].filter((field) => current[field] !== saved[field]);
  });

  readonly hasPendingFiles = computed(
    () => this.activeSection() === 'documents' && (!!this.selectedLogoFile() || !!this.selectedFaviconFile()),
  );

  readonly isDirty = computed(() => this.dirtyFields().length > 0 || this.hasPendingFiles());

  /** « Deux champs modifiés · non enregistrés ». */
  readonly dirtyLabel = computed(() => {
    const count = this.dirtyFields().length + (this.selectedLogoFile() ? 1 : 0) + (this.selectedFaviconFile() ? 1 : 0);
    if (count === 0) return '';
    return `${count} champ${count > 1 ? 's' : ''} modifié${count > 1 ? 's' : ''} · non enregistré${count > 1 ? 's' : ''}`;
  });

  ngOnInit(): void {
    this.cityService.getCities().subscribe((cities) => (this.cities = cities));
    this.loadSettings();
    this.loadCounts();
  }

  selectSection(section: SettingsSectionId): void {
    if (section === this.activeSection()) return;
    // Changer de section abandonne ce qui n'a pas été enregistré : chaque
    // section a son propre pied, garder des modifications invisibles d'une
    // section à l'autre serait un piège.
    this.revert();
    this.activeSection.set(section);
    this.successMessage.set('');
  }

  go(entry: SettingsEntry): void {
    if (entry.route) this.router.navigate([entry.route]);
  }

  visibleEntries(entries: SettingsEntry[]): SettingsEntry[] {
    return entries.filter((entry) => !entry.permission || this.authService.hasPermission(entry.permission));
  }

  countFor(entry: SettingsEntry): number | null {
    return entry.countKey ? this.counts()[entry.countKey] ?? null : null;
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

  /**
   * Enregistre la section affichée. L'API prend la fiche entière ; on envoie
   * donc l'état courant, qui ne diffère de l'enregistré que sur cette section
   * puisque changer de section annule ce qui traîne.
   */
  save(): void {
    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.settingsService
      .updateCompanySettings(this.form(), this.selectedLogoFile(), this.selectedFaviconFile())
      .subscribe({
        next: (settings) => {
          this.applySettings(settings);
          this.successMessage.set(`${this.header().title} · enregistré.`);
          this.lastSavedAt.set(new Date());
          this.saving.set(false);
        },
        error: () => {
          this.errorMessage.set("Impossible d'enregistrer cette section.");
          this.saving.set(false);
        },
      });
  }

  /** « Annuler » : la section revient à ce qui est enregistré, elle seule. */
  revert(): void {
    const saved = this.saved();
    const fields = SECTION_FIELDS[this.activeSection()];

    this.form.update((current) => {
      const next = { ...current };
      for (const field of fields) (next as Record<string, unknown>)[field] = saved[field];
      return next;
    });

    this.selectedLogoFile.set(null);
    this.selectedFaviconFile.set(null);
    this.logoUrl.set(this.savedLogoUrl);
    this.faviconUrl.set(this.savedFaviconUrl);
    this.errorMessage.set('');
  }

  updateField<K extends keyof UpdateCompanySettingsPayload>(key: K, value: UpdateCompanySettingsPayload[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedLogoFile.set(file);
    this.updateField('remove_logo', false);
    if (file) this.logoUrl.set(URL.createObjectURL(file));
  }

  onFaviconSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFaviconFile.set(file);
    this.updateField('remove_favicon', false);
    if (file) this.faviconUrl.set(URL.createObjectURL(file));
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

  private savedLogoUrl: string | null = null;
  private savedFaviconUrl: string | null = null;

  private applySettings(settings: CompanySettings): void {
    const payload = mapSettingsToPayload(settings);
    this.form.set(payload);
    this.saved.set({ ...payload });
    this.savedLogoUrl = settings.logo_url ?? null;
    this.savedFaviconUrl = settings.favicon_url ?? null;
    this.logoUrl.set(this.savedLogoUrl);
    this.faviconUrl.set(this.savedFaviconUrl);
    this.selectedLogoFile.set(null);
    this.selectedFaviconFile.set(null);
  }

  /**
   * Les comptes de la liste de gauche. Chacun vient d'un endpoint qui sait déjà
   * répondre ; un échec laisse simplement l'entrée sans chiffre, ce qui vaut
   * mieux qu'un zéro qui se lirait comme « aucun ».
   */
  private loadCounts(): void {
    const put = (key: NonNullable<SettingsEntry['countKey']>, value: number) =>
      this.counts.update((all) => ({ ...all, [key]: value }));

    this.settingsService.countBrands().subscribe({ next: (n) => put('brands', n), error: () => {} });
    this.settingsService.countCarriers().subscribe({ next: (n) => put('carriers', n), error: () => {} });
    this.settingsService.countUsers().subscribe({ next: (n) => put('users', n), error: () => {} });
    this.settingsService.countRoles().subscribe({ next: (n) => put('roles', n), error: () => {} });
    this.settingsService.countTransactionCategories().subscribe({
      next: (n) => put('transactionCategories', n),
      error: () => {},
    });
  }
}

function emptyPayload(): UpdateCompanySettingsPayload {
  return {
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
    prime_threshold: 0,
  } as UpdateCompanySettingsPayload;
}

function mapSettingsToPayload(settings: CompanySettings): UpdateCompanySettingsPayload {
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
    prime_threshold: settings.prime_threshold ?? 0,
  } as UpdateCompanySettingsPayload;
}
