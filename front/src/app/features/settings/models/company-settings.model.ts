export type ThemeMode = 'light' | 'dark' | 'system';
export type MenuLayout = 'horizontal' | 'vertical';
export type NavbarVariant = 'default' | 'compact' | 'flat';
export type ContentWidth = 'full' | 'boxed' | 'compact';

export interface CompanySettings {
  company_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  rc: string | null;
  ice: string | null;
  cnss: string | null;
  patente: string | null;
  logo_path?: string | null;
  logo_url: string | null;
  favicon_path?: string | null;
  favicon_url: string | null;
  theme_mode: ThemeMode;
  primary_color: string;
  accent_color: string;
  surface_color: string;
  menu_layout: MenuLayout;
  navbar_variant: NavbarVariant;
  content_width: ContentWidth;
  prime_threshold: number;
  /**
   * Jours de fermeture hebdomadaires, 0 (dimanche) à 6 (samedi) — la
   * numérotation de `Date#getDay`. Une liste vide est une boutique ouverte
   * sept jours sur sept, pas une absence de réglage.
   */
  closed_weekdays: number[];
  /** Fermetures exceptionnelles, en `YYYY-MM-DD`. */
  holidays: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpdateCompanySettingsPayload {
  company_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  rc: string | null;
  ice: string | null;
  cnss: string | null;
  patente: string | null;
  remove_logo?: boolean;
  remove_favicon?: boolean;
  /**
   * Thème et disposition — facultatifs depuis la refonte 2b, 7a : le
   * personnalisateur a été retiré de l'écran et la page n'envoie plus aucun de
   * ces champs. Les déclarer obligatoires obligeait `emptyPayload()` à mentir
   * par un `as`, qui a fini par masquer une vraie erreur de type. L'API les
   * accepte toujours, d'où leur maintien ici.
   */
  theme_mode?: ThemeMode;
  primary_color?: string;
  accent_color?: string;
  surface_color?: string;
  menu_layout?: MenuLayout;
  navbar_variant?: NavbarVariant;
  content_width?: ContentWidth;
  prime_threshold?: number;
  closed_weekdays: number[];
  holidays: string[];
}

export const DEFAULT_COMPANY_THEME_SETTINGS: Pick<
  CompanySettings,
  'theme_mode' | 'primary_color' | 'accent_color' | 'surface_color' | 'menu_layout' | 'navbar_variant' | 'content_width'
> = {
  theme_mode: 'system',
  primary_color: '#ff2d37',
  accent_color: '#1e293b',
  surface_color: '#ffffff',
  menu_layout: 'vertical',
  navbar_variant: 'default',
  content_width: 'full',
};
