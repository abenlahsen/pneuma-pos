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
    path: 'settings',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view settings' },
    loadComponent: () =>
      import('./features/settings/pages/company-settings-page.component').then((m) => m.CompanySettingsPageComponent),
  },
  {
    path: 'activity-log',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view activity-log' },
    loadComponent: () =>
      import('./features/activity-log/pages/activity-log-page.component').then((m) => m.ActivityLogPageComponent),
  },
  {
    path: 'kpi-history',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'view activity-log' },
    loadComponent: () =>
      import('./features/kpi-history/pages/kpi-history-page.component').then((m) => m.KpiHistoryPageComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
