export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  permission?: string;
  exact?: boolean;
  children?: NavItem[];
}

// Refonte 2b, étape 3 — reprise telle quelle de l'arbre qui vivait dans
// shared/navbar/navbar.component.ts (mêmes routes, mêmes permissions,
// mêmes regroupements) : seule la présentation change, pas la navigation.
// Un élément avec `children` s'ouvre en volet superposé depuis le rail
// (RailComponent) au lieu d'un menu déroulant horizontal.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', icon: 'home', route: '/dashboard', exact: true },
  { label: 'Ventes', icon: 'tag', route: '/sales', permission: 'view sales' },
  { label: 'Service Auto', icon: 'wrench', route: '/service-orders', permission: 'view service-orders' },
  { label: 'Achats', icon: 'package', route: '/achats', permission: 'view purchases' },
  { label: 'Cash Flow', icon: 'banknote', route: '/cash-flow', permission: 'view cash-flow' },
  {
    label: 'Stock',
    icon: 'package',
    children: [
      { label: 'Produits', icon: 'package', route: '/products', permission: 'view products' },
      { label: 'Inventaire', icon: 'package', route: '/stock', permission: 'view stock' },
      { label: 'Marques', icon: 'building-2', route: '/brands', permission: 'view brands' },
    ],
  },
  {
    label: 'Tiers',
    icon: 'handshake',
    children: [
      { label: 'Clients', icon: 'user', route: '/clients', permission: 'view clients' },
      { label: 'Fournisseurs', icon: 'building', route: '/suppliers', permission: 'view suppliers' },
      { label: 'Transporteurs', icon: 'truck', route: '/carriers', permission: 'view carriers' },
      { label: 'Partenaires', icon: 'handshake', route: '/partners', permission: 'view partners' },
    ],
  },
  {
    label: 'Finance',
    icon: 'banknote',
    children: [
      { label: 'Comptes', icon: 'banknote', route: '/accounts', permission: 'view accounts' },
      { label: 'Primes', icon: 'target', route: '/primes', permission: 'view primes' },
      { label: 'Charges RH', icon: 'receipt', route: '/charges-rh', permission: 'view hr-charges' },
      { label: 'Reporting', icon: 'bar-chart', route: '/reporting', permission: 'view reporting' },
    ],
  },
  /**
   * Refonte 2b, 17a : Utilisateurs, Rôles, Activité et les catégories de
   * transaction ont quitté le rail. Ce sont des réglages, et la liste de gauche
   * des Paramètres y conduit désormais. Leurs routes ne changent pas.
   *
   * L'historique des KPI reste ici : c'est une consultation, pas un réglage.
   */
  { label: 'KPI', icon: 'trending-up', route: '/kpi-history', permission: 'view activity-log' },
  { label: 'Paramètres', icon: 'settings', route: '/settings', permission: 'view settings' },
];
