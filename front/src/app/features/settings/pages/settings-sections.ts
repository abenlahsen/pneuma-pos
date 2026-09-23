/**
 * La liste de gauche des Paramètres — refonte 2b, gabarit 17a.
 *
 * Deux natures d'entrée cohabitent, et le gabarit les mêle volontairement :
 * celles qui éditent un réglage ici même (`form`), et celles qui conduisent à
 * un écran qui existe déjà ailleurs (`route`). Les référentiels, les
 * utilisateurs, les rôles et le journal ne sont pas réimplémentés : ce sont des
 * réglages, ils appartiennent à cette liste, mais ils gardent leurs routes.
 */
export type SettingsSectionId =
  | 'identity'
  | 'opening'
  | 'documents'
  | 'primes';

export interface SettingsEntry {
  label: string;
  /** Section éditée sur place. */
  section?: SettingsSectionId;
  /** Écran existant vers lequel l'entrée conduit. */
  route?: string;
  /** Permission requise pour voir l'entrée. */
  permission?: string;
  /** Compte affiché à droite du libellé, quand on sait le calculer. */
  countKey?: 'brands' | 'carriers' | 'transactionCategories' | 'users' | 'roles';
}

export interface SettingsGroup {
  label: string;
  entries: SettingsEntry[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Entreprise',
    entries: [
      { label: 'Identité et contact', section: 'identity' },
      { label: 'Jours de fermeture', section: 'opening' },
      { label: 'Documents et logo', section: 'documents' },
    ],
  },
  {
    label: 'Commercial',
    entries: [
      { label: 'Objectifs et primes', section: 'primes' },
    ],
  },
  {
    label: 'Référentiels',
    entries: [
      { label: 'Marques', route: '/brands', permission: 'view brands', countKey: 'brands' },
      { label: 'Transporteurs', route: '/carriers', permission: 'view carriers', countKey: 'carriers' },
      {
        label: 'Catégories de transaction',
        route: '/settings/transaction-categories',
        permission: 'view transaction-categories',
        countKey: 'transactionCategories',
      },
    ],
  },
  {
    label: 'Accès',
    entries: [
      { label: 'Utilisateurs', route: '/users', permission: 'view users', countKey: 'users' },
      { label: 'Rôles et permissions', route: '/roles', permission: 'view roles', countKey: 'roles' },
      { label: "Journal d'activité", route: '/activity-log', permission: 'view activity-log' },
    ],
  },
];

/** Le titre et la phrase d'accroche de chaque section éditable. */
export const SECTION_HEADERS: Record<SettingsSectionId, { title: string; hint: string }> = {
  identity: {
    title: 'Identité et contact',
    hint: 'Ces informations apparaissent sur les devis, les factures et les bons de livraison.',
  },
  opening: {
    title: 'Jours de fermeture',
    hint: "Les jours où la boutique ne vend pas. Ils servent à compter les jours ouvrés restants dans le mois, et donc la projection de l'objectif de primes.",
  },
  documents: {
    title: 'Documents et logo',
    hint: "Le logo est repris en tête des documents imprimés, le favicon dans l'onglet du navigateur.",
  },
  primes: {
    title: 'Objectifs et primes',
    hint: "L'objectif collectif mensuel de pneus au-delà duquel les primes des commerciaux se débloquent.",
  },
};
