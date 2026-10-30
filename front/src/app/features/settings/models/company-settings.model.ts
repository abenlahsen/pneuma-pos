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
  /**
   * Taux de TVA de la facture, en pourcentage (20 par défaut). Les ventes
   * sont enregistrées TTC : la facture en reconstitue le hors-taxe.
   */
  vat_rate?: number | string | null;
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
   * Facultatif : aucun contrôle de l'écran ne le règle, mais l'API l'accepte
   * et app.scss le lit. Les couleurs et le mode clair/sombre, retirés de
   * l'écran à l'étape 7a, n'existent plus côté API.
   */
  content_width?: ContentWidth;
  prime_threshold?: number;
  closed_weekdays: number[];
  holidays: string[];
}

export const DEFAULT_CONTENT_WIDTH: ContentWidth = 'full';
