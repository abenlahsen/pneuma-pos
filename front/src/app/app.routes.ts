import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'cash-flow',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view cash-flow' },
    loadComponent: () =>
      import('./features/cash-flow/pages/cash-flow-page.component').then((m) => m.CashFlowPageComponent),
  },
  {
    path: 'accounts',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view accounts' },
    loadComponent: () =>
      import('./features/accounts/pages/accounts-page.component').then((m) => m.AccountsPageComponent),
  },
  {
    path: 'sales',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view sales' },
    loadComponent: () =>
      import('./features/sales/pages/sales-page.component').then((m) => m.SalesPageComponent),
  },
  {
    path: 'sales/new',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'create sales' },
    loadComponent: () =>
      import('./features/sales/sale-form-page/sale-form-page.component').then((m) => m.SaleFormPageComponent),
  },
  {
    path: 'sales/:id/edit',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'edit sales' },
    loadComponent: () =>
      import('./features/sales/sale-form-page/sale-form-page.component').then((m) => m.SaleFormPageComponent),
  },
  {
    path: 'sales/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view sales' },
    loadComponent: () =>
      import('./features/sales/sale-detail-page/sale-detail-page.component').then((m) => m.SaleDetailPageComponent),
  },
  {
    // Refonte 2b, 9d : l'aperçu de la lettre au transporteur sort de la modale
    // et devient adressable, sur le modèle du relevé client.
    path: 'shipment-changes/:id/print',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view shipment-changes' },
    loadComponent: () =>
      import('./features/shipment-changes/pages/shipment-change-print-page.component').then(
        (m) => m.ShipmentChangePrintPageComponent,
      ),
  },
  {
    path: 'service-orders',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view service-orders' },
    loadComponent: () =>
      import('./features/service-orders/pages/service-orders.component').then((m) => m.ServiceOrdersComponent),
  },
  {
    path: 'suppliers',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view suppliers' },
    loadComponent: () =>
      import('./features/suppliers/pages/suppliers-page.component').then((m) => m.SuppliersPageComponent),
  },
  {
    path: 'suppliers/new',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'create suppliers' },
    loadComponent: () =>
      import('./features/suppliers/supplier-form-page/supplier-form-page.component').then((m) => m.SupplierFormPageComponent),
  },
  {
    path: 'suppliers/:id/edit',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'edit suppliers' },
    loadComponent: () =>
      import('./features/suppliers/supplier-form-page/supplier-form-page.component').then((m) => m.SupplierFormPageComponent),
  },
  {
    path: 'suppliers/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view suppliers' },
    loadComponent: () =>
      import('./features/suppliers/pages/supplier-detail-page.component').then((m) => m.SupplierDetailPageComponent),
  },
  {
    path: 'carriers',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view carriers' },
    loadComponent: () =>
      import('./features/carriers/pages/carriers-page.component').then((m) => m.CarriersPageComponent),
  },
  {
    path: 'partners',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view partners' },
    loadComponent: () =>
      import('./features/partners/pages/partners-page.component').then((m) => m.PartnersPageComponent),
  },
  {
    path: 'clients',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view clients' },
    loadComponent: () =>
      import('./features/clients/pages/clients-page.component').then((m) => m.ClientsPageComponent),
  },
  {
    path: 'clients/new',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'create clients' },
    loadComponent: () =>
      import('./features/clients/client-form-page/client-form-page.component').then((m) => m.ClientFormPageComponent),
  },
  {
    path: 'clients/:id/edit',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'edit clients' },
    loadComponent: () =>
      import('./features/clients/client-form-page/client-form-page.component').then((m) => m.ClientFormPageComponent),
  },
  {
    path: 'clients/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view clients' },
    loadComponent: () =>
      import('./features/clients/pages/client-detail-page.component').then((m) => m.ClientDetailPageComponent),
  },
  {
    path: 'achats',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view purchases' },
    loadComponent: () =>
      import('./features/purchases/pages/purchases-page.component').then((m) => m.PurchasesPageComponent),
  },
  {
    path: 'achats/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view purchases' },
    loadComponent: () =>
      import('./features/purchases/purchase-detail-page/purchase-detail-page.component').then((m) => m.PurchaseDetailPageComponent),
  },
  {
    path: 'stock',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view stock' },
    loadComponent: () =>
      import('./features/stock/pages/stock-page.component').then((m) => m.StockPageComponent),
  },
  {
    path: 'products',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view products' },
    loadComponent: () =>
      import('./features/products/pages/products-page.component').then((m) => m.ProductsPageComponent),
  },
  {
    path: 'products/new',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'create products' },
    loadComponent: () =>
      import('./features/products/product-form-page/product-form-page.component').then((m) => m.ProductFormPageComponent),
  },
  {
    path: 'products/:id/edit',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'edit products' },
    loadComponent: () =>
      import('./features/products/product-form-page/product-form-page.component').then((m) => m.ProductFormPageComponent),
  },
  {
    path: 'brands',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view brands' },
    loadComponent: () =>
      import('./features/brands/pages/brands-page.component').then((m) => m.BrandsPageComponent),
  },
  {
    path: 'roles',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view roles' },
    loadComponent: () =>
      import('./features/roles/pages/roles-page.component').then((m) => m.RolesPageComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view users' },
    loadComponent: () =>
      import('./features/users/pages/users-page.component').then((m) => m.UsersPageComponent),
  },
  {
    path: 'primes',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view primes' },
    loadComponent: () =>
      import('./features/primes/pages/primes-page.component').then((m) => m.PrimesPageComponent),
  },
  {
    path: 'charges-rh',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view hr-charges' },
    loadComponent: () =>
      import('./features/hr-charges/pages/hr-charges-page.component').then((m) => m.HrChargesPageComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view settings' },
    loadComponent: () =>
      import('./features/settings/pages/company-settings-page.component').then((m) => m.CompanySettingsPageComponent),
  },
  {
    path: 'settings/transaction-categories',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view transaction-categories' },
    loadComponent: () =>
      import('./features/transaction-categories/pages/transaction-categories-page.component').then((m) => m.TransactionCategoriesPageComponent),
  },
  {
    path: 'activity-log',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view activity-log' },
    loadComponent: () =>
      import('./features/activity-log/pages/activity-log-page.component').then((m) => m.ActivityLogPageComponent),
  },
  {
    // Refonte 2b, 9c : le jour sélectionné vit dans l'URL, pour qu'un lien vers
    // une journée précise se partage. Le détail n'est pas un autre écran, c'est
    // la moitié droite de celui-ci — d'où une seule route portant le paramètre.
    //
    // `latest` est le sentinelle « le jour le plus récent » : il ne peut pas se
    // résoudre avant que les données arrivent. Une seule entrée de route plutôt
    // que deux, pour que passer d'un jour à l'autre ne soit qu'un changement de
    // paramètre — et ne détruise pas le composant à chaque flèche.
    path: 'kpi-history',
    pathMatch: 'full',
    redirectTo: 'kpi-history/latest',
  },
  {
    path: 'kpi-history/:date',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view activity-log' },
    loadComponent: () =>
      import('./features/kpi-history/pages/kpi-history-page.component').then((m) => m.KpiHistoryPageComponent),
  },
  {
    path: 'reporting',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view reporting' },
    loadComponent: () =>
      import('./features/reporting/pages/reporting-page.component').then((m) => m.ReportingPageComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
