export interface RailItem {
  /** Clé d'icône — voir PATHS dans icon.component.ts */
  icon: string;
  /** Libellé : infobulle dans le rail, titre du panneau, texte de recherche. */
  label: string;
  /** Destination directe. Exclusif avec `children`. */
  route?: string;
  exact?: boolean;
  permission?: string;
  /** Sous-destinations : l'icône ouvre un panneau au lieu de naviguer. */
  children?: RailItem[];
}

/* — Structure : reprise telle quelle de navbar.component.ts, emoji retirés
     des libellés et remplacés par une clé d'icône. Les cinq premières
     entrées sont les pages quotidiennes ; elles naviguent directement.
     Partagé entre RailComponent et CommandPaletteComponent — ce dernier ne
     doit pas dépendre du rail, seulement de cette liste de données. — */
export const NAV_ITEMS: RailItem[] = [
  { icon: 'home',      label: 'Accueil',      route: '/dashboard', exact: true },
  { icon: 'sales',     label: 'Ventes',       route: '/sales',           permission: 'view sales' },
  { icon: 'service',   label: 'Service Auto', route: '/service-orders',  permission: 'view service-orders' },
  { icon: 'purchases', label: 'Achats',       route: '/achats',          permission: 'view purchases' },
  { icon: 'cash',      label: 'Cash Flow',    route: '/cash-flow',       permission: 'view cash-flow' },
  {
    icon: 'stock', label: 'Stock',
    children: [
      { icon: 'stock',     label: 'Produits',   route: '/products', permission: 'view products' },
      { icon: 'inventory', label: 'Inventaire', route: '/stock',    permission: 'view stock' },
      { icon: 'brands',    label: 'Marques',    route: '/brands',   permission: 'view brands' },
    ],
  },
  {
    icon: 'parties', label: 'Tiers',
    children: [
      { icon: 'client',   label: 'Clients',       route: '/clients',   permission: 'view clients' },
      { icon: 'supplier', label: 'Fournisseurs',  route: '/suppliers', permission: 'view suppliers' },
      { icon: 'carrier',  label: 'Transporteurs', route: '/carriers',  permission: 'view carriers' },
      { icon: 'partner',  label: 'Partenaires',   route: '/partners',  permission: 'view partners' },
    ],
  },
  {
    icon: 'finance', label: 'Finance',
    children: [
      { icon: 'finance',   label: 'Comptes',    route: '/accounts',   permission: 'view accounts' },
      { icon: 'bonus',     label: 'Primes',     route: '/primes',     permission: 'view primes' },
      { icon: 'payroll',   label: 'Charges RH', route: '/charges-rh', permission: 'view hr-charges' },
      { icon: 'reporting', label: 'Reporting',  route: '/reporting',  permission: 'view reporting' },
    ],
  },
  {
    icon: 'settings', label: 'Administration',
    children: [
      { icon: 'users',     label: 'Utilisateurs', route: '/users',        permission: 'view users' },
      { icon: 'roles',     label: 'Rôles',        route: '/roles',        permission: 'view roles' },
      { icon: 'activity',  label: 'Activité',     route: '/activity-log', permission: 'view activity-log' },
      { icon: 'kpi',       label: 'KPI',          route: '/kpi-history',  permission: 'view activity-log' },
      { icon: 'settings',  label: 'Entreprise',   route: '/settings',     permission: 'view settings' },
      { icon: 'brands',    label: 'Catégories',   route: '/settings/transaction-categories', permission: 'view transaction-categories' },
    ],
  },
];

/* — Étape 5 : espace client B2B. Quatre entrées, aucun enfant : pas de
     panneau, rien de la structure interne (Primes, Charges RH, Activité…)
     n'est atteignable ni devinable depuis cette liste distincte. — */
export const PORTAL_NAV_ITEMS: RailItem[] = [
  { icon: 'invoice',  label: 'Mes commandes', route: '/portail',          exact: true },
  { icon: 'quote',    label: 'Devis',         route: '/portail/devis' },
  { icon: 'payroll',  label: 'Factures',      route: '/portail/factures' },
  { icon: 'client',   label: 'Mon compte',    route: '/portail/compte' },
];
